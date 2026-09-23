/**
 * Guard-ы маршрутизатора: boot-последовательность из архитектуры фронтенда.
 *
 * Перед первой навигацией загружается `/auth/me`. Гость с защищённого адреса
 * уходит на вход с безопасным путём возврата; пользователь без членств — к
 * созданию организации; с несколькими членствами без действительного
 * выбора — к списку пространств. Guard улучшает маршрутизацию, но не
 * является контролем доступа: его выполняет сервер на каждом запросе.
 */
import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router'
import { useSessionStore, type SessionStore } from '@/entities/session'

/** Путь возврата не записывается для адресов по умолчанию, чтобы не засорять URL. */
function returnQuery(to: RouteLocationNormalized): Record<string, string> {
  return to.fullPath === '/radar' || to.fullPath === '/' ? {} : { redirect: to.fullPath }
}

export function resolveAccess(
  to: RouteLocationNormalized,
  session: Pick<SessionStore, 'status' | 'isAuthenticated' | 'memberships' | 'hasTenant'>,
): RouteLocationRaw | boolean {
  if (session.status === 'error') return false
  const access = to.meta.access
  if (access === 'guest') return session.isAuthenticated ? { name: 'radar' } : true
  if (access === 'session' || access === 'tenant') {
    if (!session.isAuthenticated) return { name: 'login', query: returnQuery(to) }
  }
  if (access === 'tenant') {
    if (session.memberships.length === 0) return { name: 'onboarding-company' }
    if (!session.hasTenant) return { name: 'workspaces', query: returnQuery(to) }
  }
  return true
}

export function installGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const session = useSessionStore()
    await session.bootstrap()
    return resolveAccess(to, session)
  })
  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · LidRadar` : 'LidRadar'
  })
}
