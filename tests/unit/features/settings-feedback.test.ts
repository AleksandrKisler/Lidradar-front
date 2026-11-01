import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { OrganizationForm } from '@/features/edit-organization'
import { BusinessHoursEditor } from '@/features/edit-business-hours'
import { updateOrganization, type Organization } from '@/entities/organization'
import { replaceBusinessHours, type Location } from '@/entities/location'

vi.mock('@/entities/session', () => ({
  useSessionStore: () => ({ refresh: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('@/entities/organization', async (original) => ({
  ...(await original<typeof import('@/entities/organization')>()),
  updateOrganization: vi.fn(),
}))
vi.mock('@/entities/location', async (original) => ({
  ...(await original<typeof import('@/entities/location')>()),
  replaceBusinessHours: vi.fn(),
}))
const organization: Organization = {
  id: 'tenant-a',
  name: 'Компания',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
}
const location: Location = {
  id: 'loc-1',
  name: 'Точка',
  timezone: 'Europe/Moscow',
  active: true,
  responseThresholdMinutes: 45,
  agreementThresholdMinutes: 120,
  businessHours: [],
  createdAt: '',
  updatedAt: '',
}
const wrappers: Array<{ unmount(): void }> = []
function setup(kind: 'company' | 'hours') {
  const wrapper = mount(kind === 'company' ? OrganizationForm : BusinessHoursEditor, {
    props:
      kind === 'company'
        ? { tenantId: 'tenant-a', organization }
        : { tenantId: 'tenant-a', location, appearance: 'settings' },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ],
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function settle() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(20)
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('N-SC-ADAPTIVE-01: краткая обратная связь настроек', () => {
  it.each(['company', 'hours'] as const)(
    '%s: saving → saved на 2 секунды → idle; успех только для screen-reader',
    async (kind) => {
      let finish!: () => void
      if (kind === 'company') {
        vi.mocked(updateOrganization).mockImplementation(
          () =>
            new Promise((resolve) => {
              finish = () => resolve({ ...organization, name: 'Новое имя' })
            }),
        )
      } else {
        vi.mocked(replaceBusinessHours).mockImplementation(
          () =>
            new Promise((resolve) => {
              finish = () => resolve(location)
            }),
        )
      }
      const wrapper = setup(kind)
      expect(wrapper.emitted('status')?.[0]).toEqual([kind === 'company' ? 'idle' : 'dirty'])
      await wrapper.get('input').setValue(kind === 'company' ? 'Новое имя' : false)
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['saving'])
      expect(wrapper.get('button[type="submit"]').text()).toBe('Сохраняем…')
      finish()
      await settle()
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['saved'])
      expect(wrapper.get('[role="status"]').classes()).toContain('sr-only')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      if (kind === 'hours') {
        // A cache refresh confirming this same week must not cancel its saved badge.
        const businessHours = vi.mocked(replaceBusinessHours).mock.calls[0]![2].days
        await wrapper.setProps({ location: { ...location, businessHours } })
        expect(wrapper.emitted('status')?.at(-1)).toEqual(['saved'])
      }
      await vi.advanceTimersByTimeAsync(1970)
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['saved'])
      await vi.advanceTimersByTimeAsync(30)
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['idle'])
    },
  )

  it.each(['company', 'hours'] as const)(
    '%s: error → dirty через 2 секунды сохраняет ввод и допускает явный retry',
    async (kind) => {
      const api =
        kind === 'company' ? vi.mocked(updateOrganization) : vi.mocked(replaceBusinessHours)
      api.mockRejectedValueOnce(new Error('offline'))
      const wrapper = setup(kind)
      const input = wrapper.get(kind === 'company' ? 'input' : 'input[name="opens-1"]')
      await input.setValue(kind === 'company' ? 'Черновик' : '07:00')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['error'])
      const errorCopy =
        kind === 'company'
          ? 'Введённые данные остались в форме. Повторите сохранение.'
          : 'Введённое время осталось в форме. Повторите сохранение.'
      expect(wrapper.text()).toContain(errorCopy)
      await vi.advanceTimersByTimeAsync(2000)
      expect(wrapper.emitted('status')?.at(-1)).toEqual(['dirty'])
      expect(wrapper.text()).toContain(errorCopy)
      expect((input.element as HTMLInputElement).value).toBe(
        kind === 'company' ? 'Черновик' : '07:00',
      )
      expect(api).toHaveBeenCalledTimes(1)
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(api).toHaveBeenCalledTimes(2)
    },
  )

  it('кнопка копирования остаётся в settings даже при одинаковых часах', async () => {
    const wrapper = setup('hours')
    const copy = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Скопировать часы'))!
    await copy.trigger('click')
    expect(copy.exists()).toBe(true)
    expect(copy.attributes('disabled')).toBeDefined()
    expect(copy.element.parentElement?.classList.contains('hidden')).toBe(false)
  })
})
