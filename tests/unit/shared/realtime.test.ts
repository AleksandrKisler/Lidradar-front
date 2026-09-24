import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, RealtimeConnection, type RealtimeHandlers } from '@/shared/api'

/**
 * Управляемый поток: тест сам решает, когда отдать байты и когда закрыть
 * соединение сервером.
 */
class FakeStream {
  private controller!: ReadableStreamDefaultController<Uint8Array>
  readonly response: Response
  constructor(status = 200) {
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller
      },
    })
    this.response = new Response(
      status === 200 ? body : JSON.stringify({ error: { code: 'X', message: '' } }),
      {
        status,
        headers: { 'Content-Type': status === 200 ? 'text/event-stream' : 'application/json' },
      },
    )
  }
  send(text: string): void {
    this.controller.enqueue(new TextEncoder().encode(text))
  }
  close(): void {
    this.controller.close()
  }
}

function setup(options: { idleTimeoutMs?: number } = {}) {
  const streams: FakeStream[] = []
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const stream = new FakeStream(nextStatus.shift() ?? 200)
    streams.push(stream)
    init.signal?.addEventListener('abort', () => {
      try {
        stream.close()
      } catch {
        // уже закрыт
      }
    })
    return Promise.resolve(stream.response)
  })
  const nextStatus: number[] = []
  const handlers: RealtimeHandlers = {
    onSignal: vi.fn(),
    onResync: vi.fn(),
    onStateChange: vi.fn(),
    onStop: vi.fn(),
  }
  const connection = new RealtimeConnection({
    baseUrl: 'http://api.test',
    fetch: fetchMock as unknown as typeof fetch,
    handlers,
    random: () => 0.5,
    ...(options.idleTimeoutMs !== undefined ? { idleTimeoutMs: options.idleTimeoutMs } : {}),
  })
  return { connection, handlers, fetchMock, streams, nextStatus }
}

describe('RealtimeConnection', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('открывает поток и передаёт сигналы и ресинхронизацию', async () => {
    const { connection, handlers, fetchMock, streams } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Tenant-ID']).toBe('tenant-a')
    streams[0]!.send('event: risk.acknowledged\ndata: {"resourceId":"r-1"}\n\n')
    streams[0]!.send('event: unknown.event\ndata: {}\n\nevent: risk.changed\ndata: not-json\n\n')
    streams[0]!.send('event: resync.required\ndata: {"reason":"BUFFER_OVERFLOW"}\n\n')
    await vi.waitFor(() => expect(handlers.onResync).toHaveBeenCalledWith('BUFFER_OVERFLOW'))
    expect(handlers.onSignal).toHaveBeenCalledTimes(1)
    expect(handlers.onSignal).toHaveBeenCalledWith({ type: 'risk.acknowledged', resourceId: 'r-1' })
    connection.stop()
    expect(connection.state).toBe('stopped')
  })

  it('после закрытия потока сервером переподключается с backoff и требует полной ресинхронизации', async () => {
    const { connection, handlers, fetchMock, streams } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    streams[0]!.close()
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    expect(handlers.onResync).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    expect(handlers.onResync).toHaveBeenCalledWith('RECONNECTED')
    connection.stop()
  })

  it('мгновенные обрывы наращивают задержку, устойчивое соединение сбрасывает её', async () => {
    const { connection, fetchMock, streams } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    streams[0]!.close()
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    // Первая попытка: 0.5 × 1000 мс.
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    streams[1]!.close()
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    // Соединение не было устойчивым: вторая попытка ждёт 0.5 × 2000 мс.
    await vi.advanceTimersByTimeAsync(600)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(500)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    // Устойчивое соединение: после 10 с разрыв снова начинает с короткой задержки.
    await vi.advanceTimersByTimeAsync(10_500)
    streams[2]!.close()
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    connection.stop()
  })

  it('401 и 403 останавливают поток и сообщают об этом', async () => {
    const { connection, handlers, nextStatus } = setup()
    nextStatus.push(401)
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('stopped'))
    expect(handlers.onStop).toHaveBeenCalledTimes(1)
    expect((vi.mocked(handlers.onStop!).mock.calls[0]![0] as ApiError).httpStatus).toBe(401)
  })

  it('офлайн приостанавливает повторы, онлайн возобновляет их сразу', async () => {
    const { connection, fetchMock, streams } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    connection.notifyOffline()
    expect(connection.state).toBe('offline')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    connection.notifyOnline()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    expect(streams).toHaveLength(2)
    connection.stop()
  })

  it('скрытая вкладка не переподключается до возвращения', async () => {
    const { connection, fetchMock, streams } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    connection.notifyVisibility(false)
    streams[0]!.close()
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    connection.notifyVisibility(true)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    connection.stop()
  })

  it('тишина дольше таймаута считается обрывом', async () => {
    const { connection, fetchMock } = setup({ idleTimeoutMs: 1000 })
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    await vi.advanceTimersByTimeAsync(1100)
    await vi.waitFor(() => expect(connection.state).toBe('backoff'))
    await vi.advanceTimersByTimeAsync(600)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    connection.stop()
  })

  it('смена организации закрывает прежний поток и открывает новый', async () => {
    const { connection, fetchMock } = setup()
    connection.start('tenant-a')
    await vi.waitFor(() => expect(connection.state).toBe('open'))
    connection.start('tenant-b')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const first = fetchMock.mock.calls[0]![1] as RequestInit
    const second = fetchMock.mock.calls[1]![1] as RequestInit
    expect(first.signal?.aborted).toBe(true)
    expect((second.headers as Record<string, string>)['X-Tenant-ID']).toBe('tenant-b')
    connection.stop()
  })
})
