import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { register, useSessionStore } from '@/entities/session'
import { RegisterForm } from '@/features/auth-session'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/** Регистрация по приглашениям (ADR 0057): поле кода, проверка формата до запроса и ответы сервера. */

const CODE = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW' // 43 символа base64url
const rejected = (code: string) => new ApiError({ httpStatus: 403, code, traceId: 't-1' })

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('RegisterForm', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.mocked(register).mockReset()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function modeIs(mode: 'open' | 'invite_only'): void {
    fetchMock.mockImplementation(async () => jsonResponse({ mode }))
  }

  function mountForm(initialCode?: string) {
    return mount(RegisterForm, {
      props: initialCode === undefined ? {} : { initialCode },
      global: {
        plugins: [
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
  }

  async function fillAndSubmit(wrapper: ReturnType<typeof mountForm>, code?: string) {
    if (code !== undefined) await wrapper.get('input[name="invite-code"]').setValue(code)
    await wrapper.get('input[name="name"]').setValue('Мария')
    await wrapper.get('input[name="email"]').setValue('maria@example.test')
    await wrapper.get('input[name="new-password"]').setValue('very-secure-password')
    await wrapper.get('form').trigger('submit')
    await settle()
  }

  it('в режиме invite_only просит код и не отправляет форму без него', async () => {
    modeIs('invite_only')
    const wrapper = mountForm()
    await settle()
    expect(wrapper.text()).toContain('Код приглашения')
    expect(wrapper.text()).not.toContain('необязательно')
    await fillAndSubmit(wrapper)
    expect(register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Для регистрации нужен код приглашения')
    expect(wrapper.get('input[name="invite-code"]').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })

  // Предел регистраций с адреса — пять в час, и неверный код тоже расходует попытку:
  // опечатку в формате форма ловит сама.
  it('не отправляет код неверного формата, не тратя попытку регистрации', async () => {
    modeIs('invite_only')
    const wrapper = mountForm()
    await settle()
    await fillAndSubmit(wrapper, 'short-code')
    expect(register).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Код состоит из 43 символов')
    wrapper.unmount()
  })

  it('отправляет нормализованный код вместе с остальными полями, очищает пароль и сообщает родителю', async () => {
    modeIs('invite_only')
    vi.mocked(register).mockResolvedValue({ user: { id: 'u' } } as never)
    const refresh = vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = mountForm()
    await settle()
    await fillAndSubmit(wrapper, `  ${CODE.slice(0, 20)}\n${CODE.slice(20)} `)
    expect(register).toHaveBeenCalledWith({
      email: 'maria@example.test',
      displayName: 'Мария',
      password: 'very-secure-password',
      inviteCode: CODE,
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('success')).toHaveLength(1)
    wrapper.unmount()
  })

  it('в открытом режиме поле кода скрыто и в запрос не попадает', async () => {
    modeIs('open')
    vi.mocked(register).mockResolvedValue({ user: { id: 'u' } } as never)
    vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = mountForm()
    await settle()
    expect(wrapper.find('input[name="invite-code"]').exists()).toBe(false)
    await fillAndSubmit(wrapper)
    expect(register).toHaveBeenCalledWith({
      email: 'maria@example.test',
      displayName: 'Мария',
      password: 'very-secure-password',
    })
    wrapper.unmount()
  })

  it('код из ссылки подставляется и в открытом режиме, где он необязателен', async () => {
    modeIs('open')
    vi.mocked(register).mockResolvedValue({ user: { id: 'u' } } as never)
    vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = mountForm(CODE)
    await settle()
    expect(wrapper.text()).toContain('необязательно')
    expect((wrapper.get('input[name="invite-code"]').element as HTMLInputElement).value).toBe(CODE)
    await fillAndSubmit(wrapper)
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ inviteCode: CODE }))
    wrapper.unmount()
  })

  it('пока режим не известен или запрос режима упал, форма просит код: решает сервер', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('offline')
    })
    const wrapper = mountForm()
    await settle()
    expect(wrapper.find('input[name="invite-code"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('INVITATION_INVALID показывается у поля одним текстом, без серверной причины и без общего алерта', async () => {
    modeIs('invite_only')
    vi.mocked(register).mockRejectedValue(rejected('INVITATION_INVALID'))
    const refresh = vi.spyOn(useSessionStore(), 'refresh').mockResolvedValue()
    const wrapper = mountForm()
    await settle()
    await fillAndSubmit(wrapper, CODE)
    expect(wrapper.text()).toContain('Код не подходит')
    expect(wrapper.text()).toContain('просрочен, уже использован или отозван')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toBeUndefined()
    wrapper.unmount()
  })

  it('INVITATION_REQUIRED от сервера тоже показывается у поля кода', async () => {
    modeIs('open')
    vi.mocked(register).mockRejectedValue(rejected('INVITATION_REQUIRED'))
    const wrapper = mountForm()
    await settle()
    await fillAndSubmit(wrapper)
    expect(wrapper.text()).toContain('Для регистрации нужен код приглашения')
    wrapper.unmount()
  })

  it('занятая почта показывается у почты, а не у кода', async () => {
    modeIs('invite_only')
    vi.mocked(register).mockRejectedValue(
      new ApiError({ httpStatus: 409, code: 'EMAIL_ALREADY_REGISTERED' }),
    )
    const wrapper = mountForm()
    await settle()
    await fillAndSubmit(wrapper, CODE)
    expect(wrapper.text()).toContain('Этот адрес уже зарегистрирован')
    expect(wrapper.text()).not.toContain('Код не подходит')
    wrapper.unmount()
  })
})
