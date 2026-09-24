/**
 * Экспоненциальная задержка с полным jitter для повторных подключений.
 * Верхняя граница не даёт ждать вечно, нижняя — молотить сервер.
 */
export interface BackoffOptions {
  /** Базовая задержка первой попытки, мс. */
  baseMs?: number
  /** Потолок задержки, мс. */
  maxMs?: number
  /** Минимальная задержка после jitter, мс. */
  floorMs?: number
  /** Источник случайности `[0, 1)`; подменяется в тестах. */
  random?: () => number
}

/** Задержка перед попыткой `attempt` (нумерация с 1). */
export function backoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const base = options.baseMs ?? 1000
  const max = options.maxMs ?? 30_000
  const floor = options.floorMs ?? 250
  const random = options.random ?? Math.random
  const exponent = Math.max(0, Math.min(attempt, 16) - 1)
  const ceiling = Math.min(max, base * 2 ** exponent)
  return Math.max(floor, Math.round(random() * ceiling))
}
