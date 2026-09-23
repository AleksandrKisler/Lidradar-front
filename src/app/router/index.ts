/** Маршрутизатор приложения: история браузера, таблица маршрутов и guard-ы. */
import { createRouter, createWebHistory, type Router } from 'vue-router'
import { installGuards } from './guards'
import { routes } from './routes'

export function createAppRouter(): Router {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  })
  installGuards(router)
  return router
}

export { resolveAccess } from './guards'
export { routes } from './routes'
