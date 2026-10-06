import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { confirmRevenue } from '@/entities/revenue'
import { ConfirmRevenueDialog, type RevenueEvidence } from '@/features/confirm-revenue'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
vi.mock('@/entities/revenue/api/revenue-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/revenue/api/revenue-api')>()),
  confirmRevenue: vi.fn(),
}))

const evidence: RevenueEvidence = {
  riskId: 'risk-1',
  opportunityId: 'opp-1',
  currency: 'RUB',
  suggestedAmount: '31000.00',
  actions: [
    { id: 'act-2', label: 'Звонок клиенту', createdAt: '2026-09-18T10:20:00Z' },
    { id: 'act-1', label: 'Переход в диалог', createdAt: '2026-09-18T10:01:00Z' },
  ],
  outcome: { id: 'out-1', label: 'Оплатил', createdAt: '2026-09-18T10:30:00Z' },
  timeZone: 'Europe/Moscow',
}

const confirmation = {
  revenue: {
    id: 'rev-1',
    opportunityId: 'opp-1',
    amount: '31000.00',
    currency: 'RUB',
    status: 'CONFIRMED' as const,
    source: 'USER_CONFIRMED' as const,
    confirmedBy: 'user-1',
    confirmedAt: '2026-09-18T12:00:00Z',
  },
  attribution: {
    id: 'att-1',
    revenueEventId: 'rev-1',
    opportunityId: 'opp-1',
    type: 'RECOVERED' as const,
    createdAt: '2026-09-18T12:00:00Z',
  },
}

/** Содержимое диалога живёт в портале: ищем по документу. */
const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

async function mountDialog(overrides: Partial<RevenueEvidence> = {}) {
  const wrapper = mount(ConfirmRevenueDialog, {
    props: { evidence: { ...evidence, ...overrides }, open: true },
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('ConfirmRevenueDialog', () => {
  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(confirmRevenue).mockReset()
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
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('подставляет сумму, валюту и доказанную цепочку по умолчанию', async () => {
    const wrapper = await mountDialog()
    expect((dialog().get('input[name="amount"]').element as HTMLInputElement).value).toBe(
      '31000.00',
    )
    expect((dialog().get('select[name="currency"]').element as HTMLSelectElement).value).toBe('RUB')
    const recovered = dialog().get('input[value="RECOVERED"]').element as HTMLInputElement
    expect(recovered.checked).toBe(true)
    expect(recovered.disabled).toBe(false)
    expect(dialog().text()).toContain('риск → звонок клиенту → исход «Оплатил»')
    expect(dialog().text()).toContain('Подтвердить 31\u00a0000\u00a0₽')
    wrapper.unmount()
  })

  it('без действия или исхода возвращённая выручка недоступна', async () => {
    const wrapper = await mountDialog({ outcome: null })
    const recovered = dialog().get('input[value="RECOVERED"]').element as HTMLInputElement
    expect(recovered.disabled).toBe(true)
    expect(recovered.checked).toBe(false)
    expect(dialog().text()).toContain('Сначала запишите действие и исход по этому риску.')
    await dialog().get('form').trigger('submit')
    await settle()
    expect(confirmRevenue).not.toHaveBeenCalled()
    expect(dialog().text()).toContain('Выберите связь с риском')
    wrapper.unmount()
  })

  it('без флажка подтверждения не отправляет, с ним — шлёт цепочку и объявляет успех', async () => {
    vi.mocked(confirmRevenue).mockResolvedValue({ confirmation, replayed: false })
    const wrapper = await mountDialog()
    await dialog().get('input[name="amount"]').setValue('5 000,50')
    await dialog().get('form').trigger('submit')
    await settle()
    expect(confirmRevenue).not.toHaveBeenCalled()
    expect(dialog().text()).toContain('Подтвердите, что оплата получена')

    await dialog().get('input[name="confirmed"]').setValue(true)
    await dialog().get('form').trigger('submit')
    await settle()
    expect(confirmRevenue).toHaveBeenCalledTimes(1)
    const [tenantId, opportunityId, key, sent] = vi.mocked(confirmRevenue).mock.calls[0]!
    expect(tenantId).toBe('tenant-a')
    expect(opportunityId).toBe('opp-1')
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(sent).toEqual({
      amount: '5000.50',
      currency: 'RUB',
      attributionType: 'RECOVERED',
      riskId: 'risk-1',
      actionId: 'act-2',
      outcomeId: 'out-1',
    })
    expect(dialog().text()).toContain('Оплата подтверждена')
    expect(dialog().text()).toContain('31\u00a0000\u00a0₽ · Возвращённая выручка')
    expect(wrapper.emitted('confirmed')).toHaveLength(1)
    await dialog().get('button').trigger('click')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('409 требует сверки истории и не предлагает повторить тот же платёж как ORGANIC', async () => {
    vi.mocked(confirmRevenue)
      .mockRejectedValueOnce(
        new ApiError({ httpStatus: 409, code: 'RECOVERED_ALREADY_ATTRIBUTED', traceId: 't' }),
      )
      .mockResolvedValueOnce({
        confirmation: {
          ...confirmation,
          attribution: { ...confirmation.attribution, type: 'ORGANIC' },
        },
        replayed: false,
      })
    const wrapper = await mountDialog()
    await dialog().get('input[name="confirmed"]').setValue(true)
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Возвращённая выручка уже учтена')
    expect((dialog().get('input[value="RECOVERED"]').element as HTMLInputElement).checked).toBe(
      true,
    )

    expect(dialog().text()).not.toContain('Подтвердить как обычную оплату')
    expect(dialog().text()).toContain('Сначала сверьте существующее подтверждение')
    expect(dialog().get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(confirmRevenue).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('неизвестный результат: диалог не закрыть, повтор тем же ключом', async () => {
    vi.mocked(confirmRevenue)
      .mockRejectedValueOnce(ApiError.network(new TypeError('offline')))
      .mockResolvedValueOnce({ confirmation, replayed: true })
    const wrapper = await mountDialog()
    await dialog().get('input[name="confirmed"]').setValue(true)
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Результат неизвестен')
    const retry = dialog()
      .findAll('button')
      .find((button) => button.text() === 'Повторить отправку')!
    await retry.trigger('click')
    await settle()
    expect(vi.mocked(confirmRevenue).mock.calls[1]![2]).toBe(
      vi.mocked(confirmRevenue).mock.calls[0]![2],
    )
    expect(dialog().text()).toContain('уже было сохранено ранее')
    wrapper.unmount()
  })
})
