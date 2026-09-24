/** Маршрутизатор приложения: история браузера, таблица маршрутов и guard-ы. */
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { recordRouteTiming } from '@/shared/observability'
import { installGuards } from './guards'
import { routes } from './routes'

/**
 * Длительность навигации записывается по шаблону маршрута (`/risks/:riskId`),
 * без параметров и query: телеметрия не должна нести идентификаторы.
 */
export function installRouteTimings(router: Router): void {
  let startedAt = 0
  router.beforeEach(() => {
    startedAt = performance.now()
  })
  router.afterEach((to, _from, failure) => {
    if (failure || startedAt === 0) return
    const template = to.matched[to.matched.length - 1]?.path ?? to.path
    recordRouteTiming(template, performance.now() - startedAt)
    startedAt = 0
  })
}

export function createAppRouter(): Router {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  })
  installGuards(router)
  installRouteTimings(router)
  return router
}

export { resolveAccess } from './guards'
export { routes } from './routes'
