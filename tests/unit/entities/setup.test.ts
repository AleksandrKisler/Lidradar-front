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
  completeWeekFromHours,
  createLocation,
  defaultWeek,
  describeDay,
  normalizeWeek,
  onboardingDefaultWeek,
  sameServerWeek,
  weekIssues,
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
    expect(errors[2]).toBe('Время окончания должно быть позже начала.')
    expect(Object.keys(errors)).toHaveLength(2)
    expect(describeDay({ weekday: 1, closed: false, opensAt: '09:00', closesAt: '20:00' })).toBe(
      '09:00–20:00',
    )
    expect(describeDay({ weekday: 7, closed: true })).toBe('выходной')
  })

  it('стартовая неделя мастера (US-M02-04): 10:00–19:00 у рабочих дней прежней маски, шаблон настроек не меняется', () => {
    const week = onboardingDefaultWeek()
    const mask = defaultWeek().map((day) => day.closed)
    expect(week.map((day) => day.closed)).toEqual(mask)
    expect(mask).toEqual([false, false, false, false, false, false, true])
    for (const day of week.filter((item) => !item.closed)) {
      expect([day.opensAt, day.closesAt]).toEqual(['10:00', '19:00'])
    }
    expect(defaultWeek()[0]).toEqual({
      weekday: 1,
      closed: false,
      opensAt: '09:00',
      closesAt: '20:00',
    })
    expect(weekIssues(week)).toBeNull()
  })

  it('строгая неделя: семь уникальных дней, HH:MM, начало раньше конца, ночной интервал не принимается', () => {
    const week = onboardingDefaultWeek()
    expect(weekIssues(week.slice(0, 6))?.[0]).toBe('time')
    expect(weekIssues([...week.slice(0, 6), { ...week[0]! }])?.[0]).toBe('time')
    expect(
      weekIssues(week.map((day) => (day.weekday === 1 ? { ...day, opensAt: '9:00' } : day))),
    ).toEqual({ 1: 'time' })
    expect(
      weekIssues(week.map((day) => (day.weekday === 2 ? { ...day, closesAt: '' } : day))),
    ).toEqual({ 2: 'time' })
    expect(
      weekIssues(week.map((day) => (day.weekday === 3 ? { ...day, opensAt: '19:00' } : day))),
    ).toEqual({ 3: 'order' })
    expect(
      weekIssues(
        week.map((day) =>
          day.weekday === 4 ? { ...day, opensAt: '20:00', closesAt: '09:00' } : day,
        ),
      ),
    ).toEqual({ 4: 'order' })
    // У выходного время не проверяется и не отправляется.
    const closed = week.map((day) =>
      day.weekday === 5 ? { ...day, closed: true, opensAt: 'x' } : day,
    )
    expect(weekIssues(closed)).toBeNull()
    expect(normalizeWeek(closed)[4]).toEqual({
      weekday: 5,
      closed: true,
      opensAt: '',
      closesAt: '',
    })
  })

  it('F-03: состав недели — ровно целые дни 1..7 без пропусков и повторов', () => {
    const week = onboardingDefaultWeek()
    const shifted = (by: number) => week.map((day) => ({ ...day, weekday: day.weekday + by }))
    // Корректная неделя в любом порядке остаётся валидной.
    expect(weekIssues(week)).toBeNull()
    expect(weekIssues([...week].reverse())).toBeNull()
    // Семь уникальных, но сдвинутых дней: нет понедельника, есть восьмой день.
    expect(weekIssues(shifted(1))?.[0]).toBe('time')
    // Выход за диапазон: 0..6.
    expect(weekIssues(shifted(-1))?.[0]).toBe('time')
    // Дробный номер вместо понедельника.
    expect(
      weekIssues(week.map((day) => (day.weekday === 1 ? { ...day, weekday: 1.5 } : day)))?.[0],
    ).toBe('time')
    // Повтор дня вместо пропущенного.
    expect(
      weekIssues(week.map((day) => (day.weekday === 7 ? { ...day, weekday: 6 } : day)))?.[0],
    ).toBe('time')
    // Неполная неделя.
    expect(weekIssues(week.slice(1))?.[0]).toBe('time')
    expect(weekIssues([])?.[0]).toBe('time')
  })

  it('полная серверная неделя и смысловое сравнение без ID строк и порядка', () => {
    const hours = [7, 1, 2, 3, 4, 5, 6].map((weekday) =>
      weekday === 7
        ? { weekday, closed: true }
        : { weekday, closed: false, opensAt: '10:00:00', closesAt: '19:00:00' },
    )
    expect(completeWeekFromHours(hours)).toEqual(onboardingDefaultWeek())
    expect(completeWeekFromHours([])).toBeNull()
    expect(completeWeekFromHours(hours.slice(1))).toBeNull()
    expect(completeWeekFromHours([...hours.slice(1), { ...hours[1]! }])).toBeNull()
    const location = { timezone: 'Europe/Moscow', businessHours: hours }
    expect(sameServerWeek(location, 'Europe/Moscow', onboardingDefaultWeek())).toBe(true)
    expect(sameServerWeek(location, 'Asia/Yekaterinburg', onboardingDefaultWeek())).toBe(false)
    expect(sameServerWeek(location, 'Europe/Moscow', defaultWeek())).toBe(false)
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
      agreementThresholdMinutes: 120,
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
