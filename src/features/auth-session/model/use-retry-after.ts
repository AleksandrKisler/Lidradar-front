/**
 * Обратный отсчёт после `429` с заголовком `Retry-After`.
 *
 * Момент разблокировки хранится в `sessionStorage` как абсолютное время,
 * поэтому перезагрузка страницы не сбрасывает ожидание раньше срока. Сервер
 * всё равно остаётся окончательным арбитром: по истечении таймера форма лишь
 * снова разрешает попытку.
 */
import { computed, onScopeDispose, ref } from 'vue'

function readStored(key: string): number | null {
  try {
    const value = globalThis.sessionStorage?.getItem(key)
    if (!value) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > Date.now() ? parsed : null
  } catch {
    return null
  }
}

function writeStored(key: string, until: number | null): void {
  try {
    if (until === null) globalThis.sessionStorage?.removeItem(key)
    else globalThis.sessionStorage?.setItem(key, String(until))
  } catch {
    // Хранилище недоступно: отсчёт продолжится только в памяти.
  }
}

export function useRetryAfter(storageKey: string) {
  const until = ref<number | null>(readStored(storageKey))
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  const secondsLeft = computed(() =>
    until.value === null ? 0 : Math.max(0, Math.ceil((until.value - now.value) / 1000)),
  )
  const active = computed(() => secondsLeft.value > 0)

  function stop(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function tick(): void {
    now.value = Date.now()
    if (!active.value) {
      stop()
      until.value = null
      writeStored(storageKey, null)
    }
  }

  function run(): void {
    stop()
    timer = setInterval(tick, 1000)
    tick()
  }

  /** Запускает ожидание на `seconds` секунд (минимум одна). */
  function start(seconds: number): void {
    until.value = Date.now() + Math.max(1, Math.round(seconds)) * 1000
    writeStored(storageKey, until.value)
    run()
  }

  function clear(): void {
    stop()
    until.value = null
    writeStored(storageKey, null)
  }

  if (until.value !== null) run()
  onScopeDispose(stop)

  return { secondsLeft, active, start, clear }
}
