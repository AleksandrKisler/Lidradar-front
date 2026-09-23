/**
 * Классификация путей API для транспорта.
 *
 * Браузер работает только с `/api/v1/*`. Вебхуки и API AI-узла из общего
 * контракта клиенту не принадлежат и блокируются до отправки. Часть путей
 * выполняется сеансом без организации; остальные требуют `X-Tenant-ID`.
 */

/** Пути, которые выполняются только сеансом, без выбранной организации. */
const sessionOnlyPrefixes = [
  '/api/v1/auth/',
  '/api/v1/admin',
  '/api/v1/organizations',
  '/api/v1/invitations/accept',
  '/health',
]

/** Пути машинных интеграций: браузер их никогда не вызывает. */
const machinePrefixes = ['/internal/', '/api/v1/webhooks/']

/** Пути входа, где 401 означает неверные реквизиты, а не истёкшую сессию. */
const credentialPaths = new Set(['/api/v1/auth/login', '/api/v1/auth/register'])

export function isMachinePath(pathname: string): boolean {
  return machinePrefixes.some((prefix) => pathname.startsWith(prefix))
}

/** Нужен ли запросу заголовок организации. */
export function isTenantScopedPath(pathname: string): boolean {
  if (isMachinePath(pathname)) return false
  if (!pathname.startsWith('/api/v1/')) return false
  return !sessionOnlyPrefixes.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Считать ли 401 на этом пути признаком потерянной сессии. Для форм входа
 * 401 — это ответ на неверные реквизиты, а `/auth/me` сам обрабатывает
 * отсутствие сессии при загрузке.
 */
export function isSessionLossPath(pathname: string): boolean {
  return !credentialPaths.has(pathname) && pathname !== '/api/v1/auth/me'
}
