import { env } from '@/shared/config'
export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
  }
}
// JSON-клиент: не логирует ответы/токены и не повторяет запросы с побочными эффектами.
// Cookie-сессии требуют серверной CSRF-защиты для изменяющих запросов.
export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(
    `${env.VITE_API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
    {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: signal ?? AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) throw new HttpError(response.status)
  return response.json() as Promise<unknown>
}
