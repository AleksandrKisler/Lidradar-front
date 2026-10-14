/**
 * Напоминание о неподтверждённой почте можно скрыть на время сессии браузера (ADR 0058).
 * Подтверждение мягкое, поэтому скрытие хранится только в `sessionStorage` и только для
 * пользователя, который его выбрал; недоступное хранилище не ломает баннер.
 */
const prefix = 'lidradar.email-reminder.dismissed:'

export function isReminderDismissed(userId: string): boolean {
  if (userId === '') return false
  try {
    return globalThis.sessionStorage?.getItem(prefix + userId) === '1'
  } catch {
    return false
  }
}

export function dismissReminder(userId: string): void {
  if (userId === '') return
  try {
    globalThis.sessionStorage?.setItem(prefix + userId, '1')
  } catch {
    // Хранилище недоступно: баннер скрыт только до перезагрузки страницы.
  }
}
