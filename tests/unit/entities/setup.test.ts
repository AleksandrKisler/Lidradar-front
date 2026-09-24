import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatAmount } from '@/shared/lib'
import {
  ONBOARDING_STEP_ORDER,
  fetchOnboardingStatus,
  isOnboardingStepDone,
  onboardingStepLabel,
  organizationKeys,
  updateOrganization,
  type OnboardingStatus,
} from '@/entities/organization'
import {
  createLocation,
  defaultWeek,
  describeDay,
  replaceBusinessHours,
  sameWeek,
  toBusinessHoursRequest,
  updateLocation,
  validateWeek,
  weekFromHours,
} from '@/entities/location'
import {
  createService,
  deactivateService,
  formatPriceRange,
  priceRangeValid,
  updateService,
} from '@/entities/service'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => vi.unstubAllGlobals())

const status: OnboardingStatus = {
  complete: false,
  nextStep: 'SERVICES',
  steps: [
    { key: 'ORGANIZATION', required: true, done: true },
    { key: 'LOCATION', required: true, done: true },
    { key: 'SERVICES', required: true, done: false },
    { key: 'CHANNEL', required: true, done: false },
    { key: 'TELEGRAM_LINK', required: false, done: false },
  ],
  facts: {
    activeLocations: 1,
    locationsWithSchedule: 1,
    activeServices: 0,
    connections: 0,
    liveConnections: 0,
    telegramLinked: false,
  },
  computedAt: '2026-09-24T00:00:00Z',
}

describe('начало работы', () => {
  it('порядок, подписи и выполненность шагов из серверного статуса', () => {
    expect(ONBOARDING_STEP_ORDER).toEqual([
      'ORGANIZATION',
      'LOCATION',
      'SERVICES',
      'CHANNEL',
      'TELEGRAM_LINK',
    ])
    expect(onboardingStepLabel('LOCATION')).toBe('Точка и график')
    expect(onboardingStepLabel('NEW')).toBe('NEW')
    expect(isOnboardingStepDone(status, 'LOCATION')).toBe(true)
    expect(isOnboardingStepDone(status, 'SERVICES')).toBe(false)
    expect(isOnboardingStepDone(null, 'LOCATION')).toBe(false)
    expect(organizationKeys.onboarding('t')).toEqual(['tenant', 't', 'onboarding'])
  })
})

describe('недельный график', () => {
  it('стартовая неделя полная, без скрытого времени у выходного', () => {
    const week = defaultWeek()
    expect(week).toHaveLength(7)
    expect(week[6]).toEqual({ weekday: 7, closed: true, opensAt: '', closesAt: '' })
    expect(validateWeek(week)).toEqual({})
    const request = toBusinessHoursRequest('Europe/Moscow', week)
    expect(request.days[6]).toEqual({ weekday: 7, closed: true })
    expect(request.days[0]).toEqual({
      weekday: 1,
      closed: false,
      opensAt: '09:00',
      closesAt: '20:00',
    })
  })

  it('черновик из сохранённого графика дополняет пропущенные дни выходными', () => {
    expect(weekFromHours([])).toBeNull()
    const week = weekFromHours([
      { weekday: 2, closed: false, opensAt: '10:00', closesAt: '19:00' },
    ])!
    expect(week[1]).toEqual({ weekday: 2, closed: false, opensAt: '10:00', closesAt: '19:00' })
    expect(week[0]?.closed).toBe(true)
    expect(
      sameWeek(
        week,
        week.map((day) => ({ ...day })),
      ),
    ).toBe(true)
  })

  it('проверяет полноту и порядок границ', () => {
    const week = defaultWeek()
    week[0]!.opensAt = ''
    week[1]!.opensAt = '20:00'
    week[1]!.closesAt = '09:00'
    const errors = validateWeek(week)
    expect(errors[1]).toBe('Укажите время открытия и закрытия')
    expect(errors[2]).toBe('Открытие должно быть раньше закрытия')
    expect(Object.keys(errors)).toHaveLength(2)
    expect(describeDay({ weekday: 1, closed: false, opensAt: '09:00', closesAt: '20:00' })).toBe(
      '09:00–20:00',
    )
    expect(describeDay({ weekday: 7, closed: true })).toBe('выходной')
  })
})

describe('цены каталога', () => {
  it('форматирует диапазоны честно и без нулей', () => {
    expect(formatAmount('50000.00')).toBe('50 000')
    expect(formatPriceRange(null, null, 'RUB')).toBe('Не указана')
    expect(formatPriceRange('42000.00', '42000.00', 'RUB')).toBe('42 000 ₽')
    expect(formatPriceRange('50000.00', '90000.00', 'RUB')).toBe('50 000–90 000 ₽')
    expect(formatPriceRange('50000.00', null, 'RUB')).toBe('от 50 000 ₽')
    expect(formatPriceRange(null, '90000.00', 'EUR')).toBe('до 90 000 €')
    expect(priceRangeValid('10.00', '5.00')).toBe(false)
    expect(priceRangeValid(null, '5.00')).toBe(true)
  })
})

describe('запросы настроек', () => {
  it('отправляет PATCH организации, точки и услуги, PUT графика и DELETE услуги', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementation((request) => {
        if (request.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }))
        if (request.url.endsWith('/onboarding')) return Promise.resolve(jsonResponse(status))
        return Promise.resolve(jsonResponse({ id: 'x' }, request.method === 'POST' ? 201 : 200))
      })
    vi.stubGlobal('fetch', fetchMock)
    await updateOrganization('t', { name: 'Новое имя' })
    await createLocation('t', {
      name: 'Точка',
      timezone: 'Europe/Moscow',
      responseThresholdMinutes: 45,
    })
    await updateLocation('t', 'loc-1', { active: false })
    await replaceBusinessHours('t', 'loc-1', toBusinessHoursRequest('Europe/Moscow', defaultWeek()))
    await createService('t', {
      name: 'Полировка',
      locationId: null,
      priceFrom: '31000.00',
      priceTo: null,
      currency: 'RUB',
    })
    await updateService('t', 'svc-1', { active: true })
    await deactivateService('t', 'svc-1')
    const onboarding = await fetchOnboardingStatus('t')
    expect(onboarding.nextStep).toBe('SERVICES')
    const calls = fetchMock.mock.calls.map(
      ([request]) => `${request.method} ${new URL(request.url).pathname}`,
    )
    expect(calls).toEqual([
      'PATCH /api/v1/organization',
      'POST /api/v1/locations',
      'PATCH /api/v1/locations/loc-1',
      'PUT /api/v1/locations/loc-1/business-hours',
      'POST /api/v1/services',
      'PATCH /api/v1/services/svc-1',
      'DELETE /api/v1/services/svc-1',
      'GET /api/v1/organization/onboarding',
    ])
    expect(await fetchMock.mock.calls[4]![0].json()).toEqual({
      name: 'Полировка',
      locationId: null,
      priceFrom: '31000.00',
      priceTo: null,
      currency: 'RUB',
    })
    const hours = (await fetchMock.mock.calls[3]![0].json()) as { days: unknown[] }
    expect(hours.days).toHaveLength(7)
    for (const [request] of fetchMock.mock.calls) {
      expect(request.headers.get('X-Tenant-ID')).toBe('t')
    }
  })
})
