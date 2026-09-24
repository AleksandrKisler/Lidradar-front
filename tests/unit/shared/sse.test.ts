import { describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  SseBufferOverflowError,
  SseParser,
  backoffDelay,
  readEventStream,
} from '@/shared/api'

function collect(parser: SseParser, chunks: string[]) {
  return chunks.flatMap((chunk) => parser.feed(chunk))
}

describe('SseParser', () => {
  it('собирает события из фрагментов, разрезанных в произвольных местах', () => {
    const parser = new SseParser()
    const messages = collect(parser, [
      ': conn',
      'ected\n\nevent: risk.ack',
      'nowledged\ndata: {"resourceId":"r-1"}\n',
      '\nevent: resync.required\r\ndata: {"reason":"BUFFER_OVERFLOW"}\r\n\r\n',
    ])
    expect(messages).toEqual([
      { event: 'risk.acknowledged', data: '{"resourceId":"r-1"}' },
      { event: 'resync.required', data: '{"reason":"BUFFER_OVERFLOW"}' },
    ])
    expect(parser.comments).toBe(1)
  })

  it('соединяет несколько строк data, читает id и retry, комментарии событие не создают', () => {
    const parser = new SseParser()
    const messages = collect(parser, [
      'data: first\ndata: second\nid: 7\nretry: 1500\n\n: heartbeat\n\n\n',
    ])
    expect(messages).toEqual([{ event: 'message', data: 'first\nsecond', id: '7', retry: 1500 }])
    expect(parser.comments).toBe(1)
  })

  it('строка без двоеточия и неизвестные поля не ломают разбор', () => {
    const parser = new SseParser()
    expect(collect(parser, ['data\nfoo: bar\nevent:risk.changed\n\n'])).toEqual([
      { event: 'risk.changed', data: '' },
    ])
  })

  it('ограничивает буфер', () => {
    const parser = new SseParser(32)
    expect(() => parser.feed('data: ' + 'x'.repeat(40) + '\n')).toThrow(SseBufferOverflowError)
  })
})

describe('backoffDelay', () => {
  it('растёт экспоненциально, ограничен потолком и полом', () => {
    const max = () => 0.999999
    expect(backoffDelay(1, { random: max })).toBe(1000)
    expect(backoffDelay(2, { random: max })).toBe(2000)
    expect(backoffDelay(6, { random: max })).toBe(30000)
    expect(backoffDelay(40, { random: max })).toBe(30000)
    expect(backoffDelay(3, { random: () => 0 })).toBe(250)
  })
})

function streamOf(
  chunks: string[],
  options: { status?: number; hold?: Promise<void> } = {},
): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      if (options.hold) await options.hold
      controller.close()
    },
  })
  return new Response(body, {
    status: options.status ?? 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('readEventStream', () => {
  it('передаёт cookie, tenant и Accept, отдаёт события и завершается с потоком', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamOf([': connected\n\n', 'event: risk.changed\ndata: {"resourceId":"r-9"}\n\n']),
      )
    const received: unknown[] = []
    const onOpen = vi.fn()
    const onChunk = vi.fn()
    await readEventStream({
      url: 'http://api.test/api/v1/events',
      tenantId: 'tenant-a',
      signal: new AbortController().signal,
      fetch: fetchMock,
      onOpen,
      onChunk,
      onMessage: (message) => received.push(message),
    })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toBe('http://api.test/api/v1/events')
    expect(init.credentials).toBe('include')
    const headers = init.headers as Record<string, string>
    expect(headers.Accept).toBe('text/event-stream')
    expect(headers['X-Tenant-ID']).toBe('tenant-a')
    expect(headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onChunk).toHaveBeenCalledTimes(2)
    expect(received).toEqual([{ event: 'risk.changed', data: '{"resourceId":"r-9"}' }])
  })

  it('неуспешный ответ становится ApiError с кодом, сеть — сетевой ошибкой', async () => {
    const unavailable = new Response(
      JSON.stringify({ error: { code: 'UNAVAILABLE', message: '', traceId: 't' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
    await expect(
      readEventStream({
        url: 'http://api.test/api/v1/events',
        tenantId: 't',
        signal: new AbortController().signal,
        fetch: vi.fn().mockResolvedValue(unavailable),
        onMessage: () => undefined,
      }),
    ).rejects.toMatchObject({ httpStatus: 503, code: 'UNAVAILABLE' })
    const error = await readEventStream({
      url: 'http://api.test/api/v1/events',
      tenantId: 't',
      signal: new AbortController().signal,
      fetch: vi.fn().mockRejectedValue(new TypeError('offline')),
      onMessage: () => undefined,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isNetwork).toBe(true)
  })

  it('отмена пробрасывается как есть', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error))
      })
    })
    const pending = readEventStream({
      url: 'http://api.test/api/v1/events',
      tenantId: 't',
      signal: controller.signal,
      fetch: fetchMock as unknown as typeof fetch,
      onMessage: () => undefined,
    })
    controller.abort(new DOMException('stop', 'AbortError'))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
