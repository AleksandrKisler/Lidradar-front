import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { createAction } from '@/entities/risk'
import { RecordActionForm } from '@/features/record-action'

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

const action = {
  id: 'act-1',
  riskId: 'risk-1',
  actorId: 'user-1',
  type: 'CALL' as const,
  createdAt: '2026-09-18T10:05:00Z',
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('RecordActionForm', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(createAction).mockReset()
    vi.mocked(fetchMe).mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' }],
    })
    await useSessionStore().bootstrap()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  function mountForm() {
    return mount(RecordActionForm, {
      props: { riskId: 'risk-1' },
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
  }

  async function fillAndSubmit(wrapper: ReturnType<typeof mountForm>, note = '') {
    await wrapper.get('select[name="actionType"]').setValue('CALL')
    if (note) await wrapper.get('textarea[name="actionNote"]').setValue(note)
    await wrapper.get('form').trigger('submit')
    await settle()
  }

  it('не отправляет форму без типа действия', async () => {
    const wrapper = mountForm()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(createAction).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Выберите, что было сделано')
    wrapper.unmount()
  })

  it('успех: ключ идемпотентности, инвалидация, объявление и сброс формы', async () => {
    vi.mocked(createAction).mockResolvedValue({ action, replayed: false })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = mountForm()
    await fillAndSubmit(wrapper, '  Договорились созвониться  ')
    expect(createAction).toHaveBeenCalledTimes(1)
    const [tenantId, riskId, key, body] = vi.mocked(createAction).mock.calls[0]!
    expect(tenantId).toBe('tenant-a')
    expect(riskId).toBe('risk-1')
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(body).toEqual({ type: 'CALL', note: 'Договорились созвониться' })
    expect(wrapper.emitted('recorded')?.[0]).toEqual([action])
    expect(wrapper.get('[role="status"]').text()).toContain('Действие записано.')
    expect(
      invalidate.mock.calls.map(
        ([filters]) => (filters as { queryKey?: readonly unknown[] } | undefined)?.queryKey,
      ),
    ).toContainEqual(['tenant', 'tenant-a', 'risk', 'risk-1'])
    expect((wrapper.get('select[name="actionType"]').element as HTMLSelectElement).value).toBe('')
    wrapper.unmount()
  })

  it('повтор прежнего результата объявляется отдельно', async () => {
    vi.mocked(createAction).mockResolvedValue({ action, replayed: true })
    const wrapper = mountForm()
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain('уже было записано ранее')
    wrapper.unmount()
  })

  it('неизвестный результат: повтор тем же ключом, кнопка отправки заблокирована', async () => {
    vi.mocked(createAction)
      .mockRejectedValueOnce(ApiError.network(new TypeError('offline')))
      .mockResolvedValueOnce({ action, replayed: false })
    const wrapper = mountForm()
    await fillAndSubmit(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('Результат неизвестен')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    const retry = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить отправку')!
    await retry.trigger('click')
    await settle()
    expect(createAction).toHaveBeenCalledTimes(2)
    expect(vi.mocked(createAction).mock.calls[1]![2]).toBe(
      vi.mocked(createAction).mock.calls[0]![2],
    )
    expect(wrapper.emitted('recorded')).toHaveLength(1)
    wrapper.unmount()
  })

  it.each([false, true])(
    'закрытый риск: обновляет карточку, не объявляет успех и сохраняет отказ при ошибке обновления %s',
    async (refreshFails) => {
      vi.mocked(createAction).mockRejectedValue(
        new ApiError({ httpStatus: 409, code: 'RISK_CLOSED', message: 'raw' }),
      )
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
      if (refreshFails) invalidate.mockRejectedValue(new Error('offline'))
      else invalidate.mockResolvedValue()
      const wrapper = mountForm()
      await fillAndSubmit(wrapper)
      expect(wrapper.get('[role="alert"]').text()).toContain('Риск закрыт')
      expect(wrapper.get('[role="alert"]').text()).not.toContain('raw')
      expect(wrapper.text()).not.toContain('Повторить отправку')
      expect(wrapper.emitted('recorded')).toBeUndefined()
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['tenant', 'tenant-a', 'risk', 'risk-1'] }),
      )
      wrapper.unmount()
    },
  )

  it('409 по ключу показывает безопасную подпись и не предлагает повтор', async () => {
    vi.mocked(createAction).mockRejectedValue(
      new ApiError({
        httpStatus: 409,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'raw',
        traceId: 't-9',
      }),
    )
    const wrapper = mountForm()
    await fillAndSubmit(wrapper)
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Повтор с другим содержимым')
    expect(alert.text()).toContain('t-9')
    expect(alert.text()).not.toContain('raw')
    expect(wrapper.text()).not.toContain('Повторить отправку')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
