import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin, useQuery } from '@tanstack/vue-query'
import { defineComponent, h, ref } from 'vue'
import { ApiError } from '@/shared/api'
import { createInvitation, teamKeys, type Invitation, type IssuedInvitation } from '@/entities/team'
import { InviteMemberDialog } from '@/features/team/invite-member'
vi.mock('@/entities/team', async (original) => ({
  ...(await original<typeof import('@/entities/team')>()),
  createInvitation: vi.fn(),
}))
const invitation: Invitation = {
  id: 'invite',
  role: 'MANAGER',
  note: 'Для коллеги',
  status: 'PENDING',
  createdBy: 'u1',
  createdAt: '2026-11-01T08:45:00Z',
  expiresAt: '2026-11-08T08:45:00Z',
  acceptedAt: null,
  acceptedBy: null,
  revokedAt: null,
  revokedBy: null,
}
const issued: IssuedInvitation = { invitation, code: 'demo_'.padEnd(43, 'x') }
const wrappers: Array<{ unmount(): void }> = []
const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role=dialog]')
const button = (name: string) =>
  dialog()
    .findAll('button')
    .find((item) => item.text() === name)!
async function settle() {
  await flushPromises()
  await vi.dynamicImportSettled()
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = mount(InviteMemberDialog, {
    props: { open: true, tenantId: 't1', contextKey: 'u1', timeZone: 'Europe/Moscow' },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return { wrapper, client }
}
beforeEach(() => {
  vi.mocked(createInvitation).mockReset()
  vi.mocked(createInvitation).mockResolvedValue(issued)
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})
describe('R54 одноразовый код и контекст', () => {
  it('определённый отказ сохраняет role/note и разрешает осознанный повтор', async () => {
    vi.mocked(createInvitation).mockRejectedValueOnce(
      new ApiError({ httpStatus: 400, code: 'INVALID_ARGUMENT' }),
    )
    setup()
    await settle()
    await dialog().get('input[value=OWNER]').setValue()
    await dialog().get('textarea').setValue('Для коллеги')
    await dialog().get('form').trigger('submit')
    await settle()
    expect((dialog().get('textarea').element as HTMLTextAreaElement).value).toBe('Для коллеги')
    expect((dialog().get('input[value=OWNER]').element as HTMLInputElement).checked).toBe(true)
    await dialog().get('form').trigger('submit')
    await settle()
    expect(createInvitation).toHaveBeenCalledTimes(2)
    expect(createInvitation).toHaveBeenLastCalledWith('t1', { role: 'OWNER', note: 'Для коллеги' })
    expect(dialog().get('[data-testid=invitation-code]').text()).toBe(issued.code)
  })
  it('unknown POST блокирует повтор того же выпуска, сохраняет черновик и не лжёт об успехе', async () => {
    vi.mocked(createInvitation).mockRejectedValue(
      new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }),
    )
    setup()
    await settle()
    await dialog().get('textarea').setValue('Для коллеги')
    await dialog().get('form').trigger('submit')
    await settle()
    expect(dialog().text()).toContain('Результат создания неизвестен')
    expect(button('Создать приглашение').attributes('disabled')).toBeDefined()
    await dialog().get('form').trigger('submit')
    await settle()
    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(dialog().find('[data-testid=invitation-code]').exists()).toBe(false)
  })
  it('ACK201 + read fail сохраняет код, ошибка списка не превращается в ошибку POST', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const read = vi.fn().mockResolvedValue([])
    const Host = defineComponent({
      setup() {
        useQuery({ queryKey: teamKeys.invitations('t1'), queryFn: read })
        const open = ref(true)
        return () =>
          h(InviteMemberDialog, {
            open: open.value,
            'onUpdate:open': (value: boolean) => {
              open.value = value
            },
            tenantId: 't1',
            timeZone: 'UTC',
          })
      },
    })
    wrappers.push(
      mount(Host, {
        global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
        attachTo: document.body,
      }),
    )
    await settle()
    read.mockRejectedValue(new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }))
    await dialog().get('form').trigger('submit')
    await settle()
    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(dialog().get('[data-testid=invitation-code]').text()).toBe(issued.code)
    expect(dialog().text()).toContain('Список приглашений не обновлён')
    expect(button('Готово').attributes('disabled')).toBeUndefined()
  })
  it('clipboard feedback появляется только после resolved write, отказ позволяет повтор', async () => {
    const copy = deferred<void>(),
      writeText = vi.fn().mockReturnValueOnce(copy.promise).mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    setup()
    await settle()
    await dialog().get('form').trigger('submit')
    await settle()
    await button('Скопировать код').trigger('click')
    expect(dialog().text()).not.toContain('Код скопирован')
    copy.reject(new Error('denied'))
    await settle()
    expect(dialog().text()).toContain('Не удалось скопировать код')
    await button('Повторить копирование').trigger('click')
    await settle()
    expect(dialog().text()).toContain('Код скопирован')
    expect(writeText).toHaveBeenLastCalledWith(issued.code)
  })
  it.each(['tenantId', 'contextKey'] as const)(
    'поздний201 после смены %s не показывает код и не вызывает issued',
    async (key) => {
      const request = deferred<IssuedInvitation>()
      vi.mocked(createInvitation).mockReturnValue(request.promise)
      const { wrapper, client } = setup()
      const refresh = vi.spyOn(client, 'refetchQueries')
      await settle()
      await dialog().get('form').trigger('submit')
      await settle()
      await wrapper.setProps({ [key]: 'new-context' })
      request.resolve(issued)
      await settle()
      expect(wrapper.emitted('issued')).toBeUndefined()
      expect(refresh).not.toHaveBeenCalled()
      expect(body().find('[data-testid=invitation-code]').exists()).toBe(false)
      await wrapper.setProps({ open: false })
      await wrapper.setProps({ open: true })
      await settle()
      expect(dialog().find('[data-testid=invitation-code]').exists()).toBe(false)
    },
  )
})
