/**
 * Запомненный выбор организации.
 *
 * Идентификатор организации — не секрет, поэтому хранится в `localStorage`,
 * но только с привязкой к пользователю: другой пользователь на том же
 * устройстве не унаследует чужой выбор. Значение всегда перепроверяется по
 * актуальному списку членств из `/auth/me`; неизвестное удаляется.
 */

const prefix = 'lidradar.tenant.'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readPreferredTenant(userId: string): string | null {
  return storage()?.getItem(prefix + userId) ?? null
}

export function rememberPreferredTenant(userId: string, tenantId: string): void {
  try {
    storage()?.setItem(prefix + userId, tenantId)
  } catch {
    // Хранилище переполнено или запрещено: выбор просто не запомнится.
  }
}

export function forgetPreferredTenant(userId: string): void {
  try {
    storage()?.removeItem(prefix + userId)
  } catch {
    // Нечего удалять или хранилище недоступно.
  }
}
