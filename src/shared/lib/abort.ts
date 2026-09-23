/**
 * Работа с отменой запросов.
 *
 * Собственные помощники нужны, потому что `AbortSignal.any` и
 * `AbortSignal.timeout` доступны не во всех средах, где выполняется код
 * (например, в jsdom при тестировании).
 */

/**
 * Объединяет несколько сигналов отмены в один: он срабатывает, как только
 * сработает любой из исходных. Уже отменённый сигнал отменяет результат сразу.
 */
export function combineSignals(...signals: (AbortSignal | null | undefined)[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (!signal) continue
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

/**
 * Сигнал, который отменяется через `milliseconds` с причиной `TimeoutError`.
 * Таймер снимается вызовом возвращённой функции `clear`, чтобы не держать
 * таймеры завершившихся запросов.
 */
export function timeoutSignal(milliseconds: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Истекло время ожидания ответа', 'TimeoutError'))
  }, milliseconds)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

/** Ошибка отмены запроса: клиентом (`AbortError`) или по таймауту (`TimeoutError`). */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

/** Отмена именно по истечении времени ожидания. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}
