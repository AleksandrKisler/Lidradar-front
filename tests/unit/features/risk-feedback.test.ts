import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { recordRiskFeedback, type RiskFeedback } from '@/entities/risk'
import { RiskFeedbackPanel } from '@/features/risk-feedback'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
vi.mock('@/entities/risk/api/commands', () => ({
  acknowledgeRisk: vi.fn(),
  resolveRisk: vi.fn(),
  ensureRecommendation: vi.fn(),
  createAction: vi.fn(),
  createOutcome: vi.fn(),
  recordRiskFeedback: vi.fn(),
}))

function feedbackOf(overrides: Partial<RiskFeedback> = {}): RiskFeedback {
  return {
    id: 'fb-1',
    riskId: 'risk-1',
    opportunityId: 'opp-1',
    actorId: 'user-1',
    verdict: 'TRUE_POSITIVE',
    note: '',
    context: {
      type: 'NO_RESPONSE',
      severity: 'HIGH',
      status: 'OPEN',
      source: 'MANUAL',
      policyVersion: 'v1',
      triggerMessageId: 'msg-1',
      opportunityStage: 'NEW',
      detectedAt: '2026-09-18T10:00:00Z',
    },
    datasetEligible: true,
    createdAt: '2026-09-18T12:00:00Z',
    ...overrides,
  }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)

describe('RiskFeedbackPanel', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(recordRiskFeedback).mockReset()
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' }],
    })
    await useSessionStore().bootstrap()
    queryClient = new QueryClient()
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function mountPanel(isActive = true) {
    return mount(RiskFeedbackPanel, {
      props: { riskId: 'risk-1', isActive },
      // Панель ссылается на экран согласия, поэтому нужен маршрутизатор.
      global: {
        plugins: [
          [VueQueryPlugin, { queryClient }],
          createRouter({
            history: createMemoryHistory(),
            routes: [
              {
                path: '/settings/privacy',
                name: 'settings-privacy',
                component: { template: '<div />' },
              },
            ],
          }),
        ],
      },
      attachTo: document.body,
    })
  }

  it('требует выбрать оценку и причину для ложного срабатывания', async () => {
    const wrapper = mountPanel()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(recordRiskFeedback).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Выберите оценку')

    await wrapper.get('input[value="FALSE_POSITIVE"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(recordRiskFeedback).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Укажите причину ложного срабатывания')
    expect(wrapper.text()).toContain('Риск закроется')
    wrapper.unmount()
  })

  it('подтверждение риска записывается сразу и показывает судьбу записи в наборе', async () => {
    vi.mocked(recordRiskFeedback).mockResolvedValue(feedbackOf({ datasetEligible: false }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mountPanel()
    await wrapper.get('input[value="TRUE_POSITIVE"]').setValue(true)
    await wrapper.get('textarea[name="feedbackNote"]').setValue('  Клиент правда ждал  ')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(recordRiskFeedback).toHaveBeenCalledWith('tenant-a', 'risk-1', {
      verdict: 'TRUE_POSITIVE',
      note: 'Клиент правда ждал',
    })
    expect(wrapper.emitted('recorded')).toHaveLength(1)
    expect(wrapper.get('[role="status"]').text()).toContain('Оценка записана')
    expect(wrapper.text()).toContain('Риск подтвердился')
    expect(wrapper.text()).toContain('не войдёт в набор для обучения')
    const keys = invalidate.mock.calls.map(
      ([filters]) => (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey,
    )
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'precision'])
    expect(keys).toContainEqual(['tenant', 'tenant-a', 'opportunity'])
    expect(wrapper.find('form').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ложное срабатывание на активном риске идёт через подтверждение и предупреждает о сделке', async () => {
    vi.mocked(recordRiskFeedback).mockResolvedValue(
      feedbackOf({ verdict: 'FALSE_POSITIVE', reason: 'NOT_A_LEAD' }),
    )
    const wrapper = mountPanel(true)
    await wrapper.get('input[value="FALSE_POSITIVE"]').setValue(true)
    await wrapper.get('select[name="feedbackReason"]').setValue('NOT_A_LEAD')
    expect(wrapper.text()).toContain('закрыта как потерянная')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Записать и закрыть риск')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(recordRiskFeedback).not.toHaveBeenCalled()
    const dialog = body().get('[role="dialog"]')
    expect(dialog.text()).toContain('Закрыть риск как ложное срабатывание?')
    expect(dialog.text()).toContain('сделка будет закрыта как потерянная')
    await dialog
      .findAll('button')
      .find((button) => button.text() === 'Закрыть риск')!
      .trigger('click')
    await settle()
    expect(recordRiskFeedback).toHaveBeenCalledWith('tenant-a', 'risk-1', {
      verdict: 'FALSE_POSITIVE',
      reason: 'NOT_A_LEAD',
    })
    expect(wrapper.text()).toContain('Ложное срабатывание · Это не клиент')
    expect(wrapper.text()).toContain('войдёт в набор для обучения: согласие организации действует')
    wrapper.unmount()
  })

  it('на закрытом риске ложное срабатывание записывается без диалога', async () => {
    vi.mocked(recordRiskFeedback).mockResolvedValue(
      feedbackOf({ verdict: 'FALSE_POSITIVE', reason: 'OTHER' }),
    )
    const wrapper = mountPanel(false)
    await wrapper.get('input[value="FALSE_POSITIVE"]').setValue(true)
    await wrapper.get('select[name="feedbackReason"]').setValue('OTHER')
    expect(wrapper.text()).not.toContain('Риск закроется')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Записать оценку')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(recordRiskFeedback).toHaveBeenCalledTimes(1)
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ошибка сервера остаётся у формы без серверного текста', async () => {
    vi.mocked(recordRiskFeedback).mockRejectedValue(
      new ApiError({ httpStatus: 403, code: 'FORBIDDEN', message: 'raw', traceId: 't-7' }),
    )
    const wrapper = mountPanel()
    await wrapper.get('input[value="TRUE_POSITIVE"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await settle()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Раздел недоступен')
    expect(alert.text()).toContain('t-7')
    expect(alert.text()).not.toContain('raw')
    expect(wrapper.find('form').exists()).toBe(true)
    wrapper.unmount()
  })
})
