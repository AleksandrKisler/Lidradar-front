/**
 * Типизация `meta` маршрутов. Правила доступа читает guard в `guards.ts`,
 * право — layout рабочего пространства, заголовок — шапка и `document.title`.
 */
import 'vue-router'
import type { Permission } from '@/entities/session'
import type { OnboardingStepKey } from '@/entities/organization'

declare module 'vue-router' {
  interface RouteMeta {
    /**
     * Требуемый контекст:
     * - `guest` — только без сессии (вход, регистрация);
     * - `session` — нужна сессия, организация не обязательна;
     * - `tenant` — нужны сессия и выбранная организация.
     */
    access?: 'guest' | 'session' | 'tenant'
    /** Право роли, без которого показывается «Раздел недоступен». */
    permission?: Permission
    /** Название раздела для шапки и заголовка окна. */
    title?: string
    /** Шаг начала работы, который отображает страница (для индикатора шагов). */
    onboardingStep?: OnboardingStepKey
  }
}
