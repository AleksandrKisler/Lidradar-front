import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { OrganizationForm } from '@/features/edit-organization'
import { organizationKeys, updateOrganization, type Organization } from '@/entities/organization'
import { tenantScope } from '@/shared/api'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/entities/session', () => ({ useSessionStore: () => ({ refresh }) }))
vi.mock('@/entities/organization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/organization')>()),
  updateOrganization: vi.fn(),
}))

const organization: Organization = {
  id: 'tenant-a',
  name: 'Студия',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
}
const otherOrganization = { ...organization, id: 'tenant-b', name: 'Компания Б' }
const api = vi.mocked(updateOrganization)
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = mount(OrganizationForm, {
    props: { tenantId: 'tenant-a', organization },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
  return { wrapper, invalidate }
}
function dialogButton(label: string) {
  return new DOMWrapper(document.body)
    .get('[role="dialog"]')
    .findAll('button')
    .find((button) => button.text() === label)!
}
function deferred() {
  let resolve!: (value: Organization) => void
  const promise = new Promise<Organization>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  refresh.mockResolvedValue(undefined)
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('US-M02-05 организация: команды и контекст', () => {
  it('блокирует два submit до async validation и повтор во время запроса', async () => {
    const pending = deferred()
    api.mockReturnValue(pending.promise)
    const { wrapper } = setup()
    await wrapper.get('input').setValue('Новое имя')
    const form = wrapper.get('form')
    await Promise.all([form.trigger('submit'), form.trigger('submit')])
    await settle()
    await form.trigger('submit')
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('tenant-a', { name: 'Новое имя' })
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    pending.resolve({ ...organization, name: 'Новое имя' })
    await settle()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })

  it('подтверждает timezone, блокирует duplicate confirm и инвалидирует его tenant', async () => {
    const pending = deferred()
    api.mockReturnValue(pending.promise)
    const { wrapper, invalidate } = setup()
    await wrapper.get('select[name="organizationTimezone"]').setValue('Asia/Almaty')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(api).not.toHaveBeenCalled()
    const confirm = dialogButton('Сохранить изменения')
    await Promise.all([confirm.trigger('click'), confirm.trigger('click')])
    await settle()
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('tenant-a', { defaultTimezone: 'Asia/Almaty' })
    pending.resolve({ ...organization, defaultTimezone: 'Asia/Almaty' })
    await settle()
    expect(
      invalidate.mock.calls.map(([filters]) =>
        typeof filters === 'function' ? undefined : filters?.queryKey,
      ),
    ).toEqual([organizationKeys.detail('tenant-a'), [...tenantScope('tenant-a'), 'analytics']])
    expect(refresh).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([false, true])(
    'сохраняет draft после отказа и разрешает retry, confirm=%s',
    async (confirm) => {
      api.mockRejectedValueOnce(new Error('failure')).mockResolvedValueOnce({
        ...organization,
        name: 'Новое имя',
        ...(confirm ? { defaultCurrency: 'KZT' } : {}),
      })
      const { wrapper } = setup()
      await wrapper.get('input').setValue('Новое имя')
      if (confirm) await wrapper.get('select[name="organizationCurrency"]').setValue('KZT')
      await wrapper.get('form').trigger('submit')
      await settle()
      if (confirm) {
        await dialogButton('Сохранить изменения').trigger('click')
        await settle()
      }
      expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Новое имя')
      expect(wrapper.emitted('saved')).toBeUndefined()
      if (confirm) {
        expect(
          wrapper.get<HTMLSelectElement>('select[name="organizationCurrency"]').element.value,
        ).toBe('KZT')
        await dialogButton('Сохранить изменения').trigger('click')
      } else await wrapper.get('form').trigger('submit')
      await settle()
      expect(api).toHaveBeenCalledTimes(2)
      expect(api.mock.calls[1]).toEqual(api.mock.calls[0])
      expect(wrapper.emitted('saved')).toHaveLength(1)
      wrapper.unmount()
    },
  )

  it('cancel возвращает пояс и валюту, сохраняя введённое имя', async () => {
    const { wrapper } = setup()
    await wrapper.get('input').setValue('Черновик')
    await wrapper.get('select[name="organizationTimezone"]').setValue('Asia/Almaty')
    await wrapper.get('select[name="organizationCurrency"]').setValue('KZT')
    await wrapper.get('form').trigger('submit')
    await settle()
    await dialogButton('Оставить прежние').trigger('click')
    await settle()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Черновик')
    expect(
      wrapper.get<HTMLSelectElement>('select[name="organizationTimezone"]').element.value,
    ).toBe('Europe/Moscow')
    expect(
      wrapper.get<HTMLSelectElement>('select[name="organizationCurrency"]').element.value,
    ).toBe('RUB')
    expect(api).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['resolve', 'reject'] as const)(
    'поздний %s A не переносит состояние в B',
    async (outcome) => {
      let reject!: (error: Error) => void
      const pending = deferred()
      api.mockReturnValue(
        new Promise((resolve, fail) => {
          pending.promise.then(resolve)
          reject = fail
        }),
      )
      const { wrapper, invalidate } = setup()
      await wrapper.get('input').setValue('Имя А')
      await wrapper.get('select[name="organizationCurrency"]').setValue('KZT')
      await wrapper.get('form').trigger('submit')
      await settle()
      await dialogButton('Сохранить изменения').trigger('click')
      await settle()
      await wrapper.setProps({ tenantId: 'tenant-b', organization: otherOrganization })
      await settle()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Компания Б')
      await wrapper.get('input').setValue('Черновик Б')
      if (outcome === 'resolve')
        pending.resolve({ ...organization, name: 'Имя А', defaultCurrency: 'KZT' })
      else reject(new Error('failure A'))
      await settle()
      expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Черновик Б')
      expect(
        wrapper.get<HTMLSelectElement>('select[name="organizationCurrency"]').element.value,
      ).toBe('RUB')
      expect(wrapper.emitted('saved')).toBeUndefined()
      expect(wrapper.text()).not.toContain('Настройки компании сохранены.')
      expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
      expect(refresh).not.toHaveBeenCalled()
      expect(
        invalidate.mock.calls.map(([filters]) =>
          typeof filters === 'function' ? undefined : filters?.queryKey,
        ),
      ).toEqual(
        outcome === 'resolve'
          ? [organizationKeys.detail('tenant-a'), [...tenantScope('tenant-a'), 'analytics']]
          : [],
      )
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    },
  )

  it('смена tenant сбрасывает открытое подтверждение и dirty без отправки', async () => {
    const { wrapper } = setup()
    await wrapper.get('input').setValue('Черновик А')
    await wrapper.get('select[name="organizationTimezone"]').setValue('Asia/Almaty')
    await wrapper.get('form').trigger('submit')
    await settle()
    await wrapper.setProps({ tenantId: 'tenant-b', organization: otherOrganization })
    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Компания Б')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(api).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('переключение до завершения валидации не отправляет команду нового tenant', async () => {
    const { wrapper } = setup()
    await wrapper.get('input').setValue('Черновик А')
    const submission = wrapper.get('form').trigger('submit')
    await wrapper.setProps({ tenantId: 'tenant-b', organization: otherOrganization })
    await submission
    await settle()
    expect(api).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Компания Б')
    wrapper.unmount()
  })

  it.each(['saved', 'error'] as const)(
    'смена tenant очищает %s и разрешает новую команду B',
    async (state) => {
      if (state === 'saved') api.mockResolvedValueOnce({ ...organization, name: 'Имя А' })
      else api.mockRejectedValueOnce(new Error('failure A'))
      const { wrapper } = setup()
      await wrapper.get('input').setValue('Имя А')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(
        wrapper.findAll(state === 'saved' ? '[role="status"]' : '[role="alert"]'),
      ).toHaveLength(1)
      await wrapper.setProps({ tenantId: 'tenant-b', organization: otherOrganization })
      await settle()
      expect(wrapper.findAll('[role="alert"], [role="status"]')).toHaveLength(0)
      expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
      api.mockResolvedValueOnce({ ...otherOrganization, name: 'Имя Б' })
      await wrapper.get('input').setValue('Имя Б')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(api).toHaveBeenLastCalledWith('tenant-b', { name: 'Имя Б' })
      wrapper.unmount()
    },
  )
})
