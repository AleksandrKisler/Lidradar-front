/** In-memory navigation position, scoped to identity, permissions and exact calendar URL. */
interface AnalyticsReturn {
  identity: string
  path: string
  top: number
  eventId: string | null
}
let saved: AnalyticsReturn | null = null
export function saveAnalyticsReturn(value: AnalyticsReturn): void {
  saved = value
}
export function readAnalyticsReturn(identity: string, path: string): AnalyticsReturn | null {
  const value = saved
  saved = null
  return value?.identity === identity && value.path === path ? value : null
}
