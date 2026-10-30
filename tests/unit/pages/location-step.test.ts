import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { Location } from '@/entities/location'
import {
  blockReasonText,
  needsWrite,
  useLocationStep,
} from '@/pages/onboarding/model/location-step'

const week = () =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) =>
    weekday === 7
      ? { weekday, closed: true }
      : { weekday, closed: false, opensAt: '09:00:00', closesAt: '20:00:00' },
  )
const location = (id: string, patch: Partial<Location> = {}): Location => ({
  id,
  name: id.toUpperCase(),
  timezone: 'Europe/Moscow',
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  active: true,
  businessHours: week(),
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  ...patch,
})
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Модель шага 2 (US-M02-04): черновики по ID, слияние ответов, контекст и ревизии. */
describe('модель шага «Точки и графики»', () => {
  let server: Location[]
  let puts: { tenant: string | null; id: string; body: { timezone: string } }[]
  let holdPut: Promise<void> | null

  beforeEach(() => {
    server = [location('a'), location('b')]
    puts = []
    holdPut = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        const path = new URL(request.url).pathname
        if (request.method === 'GET' && path === '/api/v1/locations') return json({ items: server })
        const match = path.match(/^\/api\/v1\/locations\/([^/]+)\/business-hours$/)
        if (match && request.method === 'PUT') {
          const body = await request.clone().json()
          puts.push({ tenant: request.headers.get('X-Tenant-ID'), id: match[1]!, body })
          if (holdPut) await holdPut
          const target = server.find((item) => item.id === match[1])!
          target.timezone = body.timezone
          target.businessHours = body.days
          return json(target)
        }
        if (path === '/api/v1/organization/onboarding')
          return json({
            complete: false,
            nextStep: 'SERVICES',
            steps: [{ key: 'LOCATION', done: true }],
          })
        return json({ error: { code: 'NOT_FOUND', message: 'x', traceId: 't' } }, 404)
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  function setup() {
    const tenant = ref<string | null>('t-1')
    const user = ref<string | null>('u-1')
    let step!: ReturnType<typeof useLocationStep>
    const wrapper = mount(
      defineComponent({
        setup() {
          step = useLocationStep({ tenantId: () => tenant.value, userId: () => user.value })
          return () => null
        },
      }),
      {
        global: {
          plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        },
      },
    )
    return { step, tenant, user, wrapper }
  }
  const edit = (step: ReturnType<typeof useLocationStep>, id: string, opensAt: string) =>
    step.updateDays(
      id,
      step.drafts.value
        .find((draft) => draft.id === id)!
        .days.map((day) => (day.weekday === 1 ? { ...day, opensAt } : { ...day })),
    )

  it('refetch обновляет чистые записи, но не стирает изменённый черновик', () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '11:00')
    const changed = [
      location('a', { name: 'A2', businessHours: week().map((d) => ({ ...d })) }),
      location('b', {
        businessHours: week().map((d) => (d.weekday === 2 ? { ...d, opensAt: '12:00:00' } : d)),
      }),
    ]
    step.merge(changed)
    const [a, b] = step.drafts.value
    expect(a!.name).toBe('A2')
    expect(a!.days[0]!.opensAt).toBe('11:00')
    expect(b!.days[1]!.opensAt).toBe('12:00')
  })

  it('выбор другой точки не копирует часы и не запускает запросы', () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '20:00')
    step.select('b')
    expect(step.selected.value!.id).toBe('b')
    expect(step.selected.value!.days[0]!.opensAt).toBe('09:00')
    expect(step.drafts.value[0]!.days[0]!.opensAt).toBe('20:00')
    expect(puts).toHaveLength(0)
  })

  it('PATCH: новый пояс уходит в следующем PUT без конверсии часов; неактивная точка уходит из шага', async () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '11:00')
    step.applyPatched(location('a', { timezone: 'Asia/Yekaterinburg' }))
    step.applyPatched(location('b', { active: false }))
    expect(step.drafts.value.map((draft) => draft.id)).toEqual(['a'])
    server = [location('a', { timezone: 'Asia/Yekaterinburg' })]
    expect(await step.saveAll()).toBe(true)
    expect(puts).toHaveLength(1)
    expect(puts[0]!.body.timezone).toBe('Asia/Yekaterinburg')
    expect(step.drafts.value[0]!.days[0]!.opensAt).toBe('11:00')
  })

  it('после ACK новая правка той же точки — новая ревизия, она снова требует записи', async () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '11:00')
    expect(await step.saveAll()).toBe(true)
    const a = step.drafts.value[0]!
    expect(needsWrite(a)).toBe(false)
    const revision = a.revision
    edit(step, 'a', '12:00')
    expect(a.revision).toBe(revision + 1)
    expect(needsWrite(a)).toBe(true)
  })

  it('смена организации сбрасывает черновики; поздний ответ прежней организации не применяется', async () => {
    const { step, tenant } = setup()
    step.merge(server)
    edit(step, 'a', '11:00')
    let release: () => void = () => {}
    holdPut = new Promise((resolve) => {
      release = resolve
    })
    const saving = step.saveAll()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(puts.map((item) => item.tenant)).toEqual(['t-1'])
    tenant.value = 't-2'
    await flushPromises()
    expect(step.drafts.value).toHaveLength(0)
    expect(step.busy.value).toBeNull()
    release()
    expect(await saving).toBe(false)
    expect(step.drafts.value).toHaveLength(0)
  })

  it('поздний ответ POST, начатого в прежней организации, не попадает в черновики новой', async () => {
    const { step, tenant } = setup()
    step.merge(server)
    const startedAt = step.token()
    tenant.value = 't-2'
    await flushPromises()
    expect(await step.addCreated(location('late'), startedAt)).toBe(false)
    expect(await step.reconcileCreate(new Set(), startedAt)).toBeNull()
    expect(step.drafts.value).toHaveLength(0)
    expect(puts).toHaveLength(0)
  })

  it('F-01: поздний PATCH, начатый в прежней организации, не меняет точки новой', async () => {
    const { step, tenant } = setup()
    step.merge(server)
    const startedAt = step.token()
    tenant.value = 't-2'
    await flushPromises()
    step.merge([location('a')])
    step.applyPatched(location('a', { name: 'Чужое имя', active: false }), startedAt)
    expect(step.drafts.value.map((draft) => [draft.id, draft.name])).toEqual([['a', 'A']])
  })

  it('F-02: PUT подтвердил 11:00, финальный GET вернул 15:00 — переход запрещён, черновик 11:00 сохранён', async () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '11:00')
    let reads = 0
    const base = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input) => {
      const request = input as Request
      const response = await base(request)
      const path = new URL(request.url).pathname
      if (request.method === 'GET' && path === '/api/v1/locations' && ++reads === 2)
        // Финальное чтение: другая запись успела изменить понедельник A.
        return json({
          items: server.map((item) =>
            item.id === 'a'
              ? {
                  ...item,
                  businessHours: item.businessHours.map((hour) =>
                    hour.weekday === 1 ? { ...hour, opensAt: '15:00' } : hour,
                  ),
                }
              : item,
          ),
        })
      return response
    })
    expect(await step.saveAll()).toBe(false)
    expect(puts.map((item) => item.id)).toEqual(['a'])
    const a = step.drafts.value.find((draft) => draft.id === 'a')!
    expect(a.days[0]).toMatchObject({ weekday: 1, opensAt: '11:00' })
    expect(a.write).toBe('diverged')
    expect(needsWrite(a)).toBe(true)
    expect(step.selectedId.value).toBe('a')
    expect(step.failure.value).toEqual({ kind: 'diverged', locationId: 'a' })
    // Без автоматической перезаписи: новый PUT только по следующей команде пользователя.
    await flushPromises()
    expect(puts).toHaveLength(1)
  })

  it('неверный черновик блокирует шаг, даже если выбрана корректная точка', () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '21:00')
    step.select('b')
    expect(step.otherInvalid.value?.id).toBe('a')
    expect(step.blockReason.value).toEqual({ kind: 'other-invalid', name: 'A' })
    expect(blockReasonText(step.blockReason.value!, 'desktop')).toBe('Исправьте график: A.')
    expect(blockReasonText(step.blockReason.value!, 'phone')).toBe('Исправьте график: A.')
  })

  it('Codex-R2 п.5: одна причина — разный текст: desktop называет день, телефон — точку', () => {
    const { step } = setup()
    step.merge(server)
    edit(step, 'a', '21:00')
    step.select('a')
    const reason = step.blockReason.value!
    expect(reason).toEqual({ kind: 'selected-invalid', name: 'A', weekday: 1 })
    expect(blockReasonText(reason, 'desktop')).toBe(
      'Исправьте время в понедельник, чтобы продолжить.',
    )
    expect(blockReasonText(reason, 'phone')).toBe('Исправьте график: A.')
    expect(blockReasonText({ kind: 'selected-invalid', name: 'A', weekday: 2 }, 'desktop')).toBe(
      'Исправьте время во вторник, чтобы продолжить.',
    )
    expect(blockReasonText({ kind: 'selected-invalid', name: 'A', weekday: null }, 'desktop')).toBe(
      'Исправьте график, чтобы продолжить.',
    )
    for (const view of ['desktop', 'phone'] as const) {
      expect(blockReasonText({ kind: 'no-points' }, view)).toBe('Сначала добавьте точку.')
      expect(blockReasonText({ kind: 'unconfirmed', name: 'B' }, view)).toBe(
        'Сохраните график точки: B.',
      )
    }
  })
})
