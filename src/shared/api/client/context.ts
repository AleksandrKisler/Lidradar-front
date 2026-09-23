/**
 * Контекст транспорта.
 *
 * `shared` не знает о хранилище сессии (это верхний слой), поэтому получает
 * нужные сведения через явно настраиваемый контекст: слой `app` передаёт его
 * при старте. До настройки контекст пустой — организация не выбрана и хуки
 * ничего не делают.
 */
import type { ApiError } from './api-error'

export interface ApiContext {
  /** Идентификатор выбранной организации или `null`, если она не выбрана. */
  tenantId: () => string | null
  /**
   * Вызывается при `401` на защищённом пути: сессия истекла или отозвана.
   * Не вызывается для форм входа и `/auth/me`.
   */
  onSessionLost?: (error: ApiError) => void
}

const emptyContext: ApiContext = { tenantId: () => null }

let current: ApiContext = emptyContext

/** Устанавливает контекст; вызывается один раз из слоя `app`. */
export function setApiContext(context: ApiContext): void {
  current = context
}

/** Сбрасывает контекст к пустому (используется тестами). */
export function resetApiContext(): void {
  current = emptyContext
}

export function getApiContext(): ApiContext {
  return current
}
