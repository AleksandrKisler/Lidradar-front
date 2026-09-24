/**
 * Разбор `text/event-stream` и чтение потока через streaming `fetch`.
 *
 * Нативный `EventSource` не умеет передать обязательный заголовок
 * `X-Tenant-ID`, поэтому поток читается вручную: ответ проверяется как
 * обычный HTTP-ответ (401/403/503 становятся `ApiError`), тело разбирается
 * инкрементально по правилам EventSource, размер буфера ограничен, сырые
 * фрагменты никуда не логируются.
 */
import { createUuid } from '@/shared/lib'
import { ApiError } from './api-error'

export interface SseMessage {
  /** Имя события из поля `event`; без него — `message`. */
  event: string
  /** Строки `data`, соединённые переводом строки. */
  data: string
  id?: string
  retry?: number
}

/** Предел накопленного, но ещё не отправленного события: защита от бесконечной строки. */
export const DEFAULT_SSE_BUFFER_LIMIT = 64 * 1024

export class SseBufferOverflowError extends Error {
  constructor() {
    super('Событие SSE превысило допустимый размер буфера')
    this.name = 'SseBufferOverflowError'
  }
}

/**
 * Инкрементальный парсер: принимает фрагменты произвольного размера и
 * возвращает завершённые события. Комментарии (heartbeat) события не создают,
 * но считаются в `comments`, чтобы соединение могло следить за живостью.
 */
export class SseParser {
  private pending = ''
  private event = ''
  private data: string[] = []
  private id: string | undefined
  private retry: number | undefined
  /** Число комментариев с начала потока (heartbeat сервера). */
  comments = 0

  constructor(private readonly bufferLimit = DEFAULT_SSE_BUFFER_LIMIT) {}

  feed(chunk: string): SseMessage[] {
    this.pending += chunk
    if (this.pending.length > this.bufferLimit) throw new SseBufferOverflowError()
    const messages: SseMessage[] = []
    let newline = this.findLineEnd()
    while (newline !== null) {
      const [line, next] = newline
      this.pending = this.pending.slice(next)
      const message = this.consumeLine(line)
      if (message) messages.push(message)
      newline = this.findLineEnd()
    }
    return messages
  }

  /** Границей строки служат `\n`, `\r\n` и одиночный `\r` (по спецификации EventSource). */
  private findLineEnd(): [string, number] | null {
    for (let index = 0; index < this.pending.length; index += 1) {
      const char = this.pending[index]
      if (char === '\n') return [this.pending.slice(0, index), index + 1]
      if (char === '\r') {
        // `\r` в самом конце фрагмента: ждём следующий, вдруг это `\r\n`.
        if (index === this.pending.length - 1) return null
        const skip = this.pending[index + 1] === '\n' ? 2 : 1
        return [this.pending.slice(0, index), index + skip]
      }
    }
    return null
  }

  private consumeLine(line: string): SseMessage | null {
    if (line === '') return this.dispatch()
    if (line.startsWith(':')) {
      this.comments += 1
      return null
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    switch (field) {
      case 'event':
        this.event = value
        break
      case 'data':
        this.data.push(value)
        if (this.data.join('\n').length > this.bufferLimit) throw new SseBufferOverflowError()
        break
      case 'id':
        if (!value.includes('\0')) this.id = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) this.retry = Number(value)
        break
      default:
        // Неизвестные поля игнорируются по спецификации.
        break
    }
    return null
  }

  private dispatch(): SseMessage | null {
    if (this.data.length === 0) {
      this.event = ''
      return null
    }
    const message: SseMessage = { event: this.event || 'message', data: this.data.join('\n') }
    if (this.id !== undefined) message.id = this.id
    if (this.retry !== undefined) message.retry = this.retry
    this.event = ''
    this.data = []
    this.retry = undefined
    return message
  }
}

export interface ReadEventStreamOptions {
  /** Полный адрес потока, например `${origin}/api/v1/events`. */
  url: string
  tenantId: string
  signal: AbortSignal
  fetch?: typeof fetch
  bufferLimit?: number
  /** Ответ принят (`200`), тело ещё не читалось. */
  onOpen?: () => void
  /** Получен фрагмент любого содержимого — признак живого соединения. */
  onChunk?: () => void
  onMessage: (message: SseMessage) => void
}

/**
 * Читает поток до его завершения сервером. Разрешается, когда сервер закрыл
 * соединение; отклоняется `ApiError` для неуспешного ответа и сетевого сбоя,
 * ошибкой отмены — при `signal.abort()`, `SseBufferOverflowError` — при
 * превышении буфера.
 */
export async function readEventStream(options: ReadEventStreamOptions): Promise<void> {
  const doFetch =
    options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  let response: Response
  try {
    response = await doFetch(options.url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'text/event-stream',
        'X-Tenant-ID': options.tenantId,
        'X-Request-ID': createUuid(),
      },
      signal: options.signal,
    })
  } catch (error) {
    if (options.signal.aborted) throw error
    throw ApiError.network(error)
  }
  if (!response.ok) {
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined)
    throw ApiError.fromResponse(response, body)
  }
  if (!response.body) throw ApiError.network(new Error('Поток событий без тела ответа'))
  options.onOpen?.()

  const parser = new SseParser(options.bufferLimit)
  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      options.onChunk?.()
      for (const message of parser.feed(decoder.decode(value, { stream: true }))) {
        options.onMessage(message)
      }
    }
  } catch (error) {
    if (options.signal.aborted) throw error
    if (error instanceof SseBufferOverflowError) throw error
    throw ApiError.network(error)
  } finally {
    reader.releaseLock()
  }
}
