import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routeForStep } from '@/pages/onboarding'
import { routes } from '@/app/router/routes'

describe('шаги начала работы', () => {
  it('серверный шаг ведёт на свой маршрут, завершение — на итог', () => {
    expect(routeForStep('ORGANIZATION')).toBe('onboarding-company')
    expect(routeForStep('LOCATION')).toBe('onboarding-location')
    expect(routeForStep('SERVICES')).toBe('onboarding-services')
    expect(routeForStep('CHANNEL')).toBe('onboarding-channel')
    expect(routeForStep('TELEGRAM_LINK')).toBe('onboarding-channel')
    expect(routeForStep(null)).toBe('onboarding-channel')
  })

  it('маршруты онбординга и настроек объявлены с нужными правами', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    expect(router.resolve('/onboarding/location').meta.permission).toBe('location.manage')
    expect(router.resolve('/onboarding/services').meta.onboardingStep).toBe('SERVICES')
    expect(router.resolve('/settings/company').meta.permission).toBe('organization.manage')
    expect(router.resolve('/settings/services').meta.permission).toBe('service.manage')
    expect(router.resolve('/settings').redirectedFrom).toBeUndefined()
  })
})
