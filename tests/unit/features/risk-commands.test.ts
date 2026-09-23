import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { acknowledgeRisk, ensureRecommendation } from '@/entities/risk'
import { AcknowledgeRiskButton, EnsureRecommendationButton } from '@/features/risk-commands'

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
}))

describe('команды риска', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(acknowledgeRisk).mockReset()
    vi.mocked(ensureRecommendation).mockReset()
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'u',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'OWNER' }],
    })
    await useSessionStore().bootstrap()
    queryClient = new QueryClient()
  })

  it('«Взять в работу» вызывает команду, инвалидирует кеш и сообщает родителю', async () => {
    vi.mocked(acknowledgeRisk).mockResolvedValue({ id: 'risk-1', status: 'ACKNOWLEDGED' } as never)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mount(AcknowledgeRiskButton, {
      props: { riskId: 'risk-1' },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await flushPromises()
    expect(acknowledgeRisk).toHaveBeenCalledWith('tenant-a', 'risk-1')
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ошибка команды показывается рядом с кнопкой без серверного текста', async () => {
    vi.mocked(acknowledgeRisk).mockRejectedValue(
      new ApiError({ httpStatus: 403, code: 'FORBIDDEN', message: 'secret', traceId: 't-3' }),
    )
    const wrapper = mount(AcknowledgeRiskButton, {
      props: { riskId: 'risk-1' },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    await flushPromises()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Раздел недоступен')
    expect(alert.text()).toContain('t-3')
    expect(alert.text()).not.toContain('secret')
    expect(wrapper.emitted('done')).toBeUndefined()
    wrapper.unmount()
  })

  it('кнопка рекомендации блокируется на время запроса и сообщает об успехе', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(ensureRecommendation).mockImplementation(
      () => new Promise((done) => (resolve = done)) as never,
    )
    const wrapper = mount(EnsureRecommendationButton, {
      props: { riskId: 'risk-1' },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(ensureRecommendation).toHaveBeenCalledTimes(1)
    resolve({ id: 'rec', text: 'Ответить' })
    await flushPromises()
    await flushPromises()
    expect(wrapper.emitted('done')).toHaveLength(1)
    wrapper.unmount()
  })
})
