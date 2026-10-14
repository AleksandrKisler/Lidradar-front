/**
 * Подпись ожидания после `429`: сброс пароля и письма подтверждения ограничены часами, а не
 * секундами, поэтому длинный отсчёт показывается в минутах.
 */
export function formatWait(seconds: number): string {
  const whole = Math.max(1, Math.ceil(seconds))
  if (whole < 90) return `${whole} с`
  return `${Math.ceil(whole / 60)} мин`
}
