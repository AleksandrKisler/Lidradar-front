/** Dates in approved Team views use full month names and the organization's timezone. */
export function teamDate(
  value: string | null | undefined,
  timeZone: string,
  withTime = true,
): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  try {
    const date = new Date(value)
    const day = new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      day: 'numeric',
      month: 'long',
    }).format(date)
    return withTime
      ? `${day}, ${new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}`
      : day
  } catch {
    return '—'
  }
}

/** Compare calendar dates in the organization zone; used for compact historical rows. */
export function isTeamEventToday(
  value: string | null | undefined,
  timeZone: string,
  asOf: number,
): boolean {
  if (!value || !Number.isFinite(Date.parse(value)) || !Number.isFinite(asOf)) return false
  try {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return day.format(new Date(value)) === day.format(new Date(asOf))
  } catch {
    return false
  }
}
