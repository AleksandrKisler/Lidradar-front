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

  describe('макет Access «Регистрация» (Figma 462:5559) и негативные проверки US-M01-01/02', () => {
    it('отправка: поля заблокированы, кнопка «Создаём аккаунт…» сохраняет доступное имя «Создать аккаунт»', async () => {
      modeIs('invite_only')
      let release: (value: never) => void = () => {}
      vi.mocked(register).mockImplementation(() => new Promise((resolve) => (release = resolve)))
      const wrapper = mountForm()
      await settle()
      await fillAndSubmit(wrapper, CODE)
      const button = wrapper.get('button[type="submit"]')
      expect(button.attributes('aria-busy')).toBe('true')
      expect(button.text()).toContain('Создаём аккаунт…')
      expect(button.get('.sr-only').text()).toBe('Создать аккаунт')
      for (const name of ['invite-code', 'name', 'email', 'new-password']) {
        expect(wrapper.get(`input[name="${name}"]`).attributes('disabled')).toBeDefined()
      }
      release({ user: { id: 'u' } } as never)
      wrapper.unmount()
    })

    it('первичная загрузка: подписи и подсказки на месте, полей и отправки нет', async () => {
      modeIs('invite_only')
      const wrapper = mount(RegisterForm, {
        props: { loading: true },
        global: {
          plugins: [
            [
              VueQueryPlugin,
              { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            ],
          ],
        },
      })
      const text = wrapper.text()
      for (const label of [
        'Код приглашения',
        'Имя',
        'Электронная почта',
        'Пароль',
        'Создать аккаунт',
      ]) {
        expect(text).toContain(label)
      }
      expect(text).toContain('43 символа')
      expect(text).toContain('Не меньше 12 символов')
      expect(wrapper.find('input').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
      wrapper.unmount()
    })

    it('ошибка поля заменяет его подсказку и связана с полем', async () => {
      modeIs('invite_only')
      const wrapper = mountForm()
      await settle()
      await fillAndSubmit(wrapper, 'LDR-2026')
      const code = wrapper.get('input[name="invite-code"]')
      expect(wrapper.text()).toContain('Код состоит из 43 символов')
      expect(wrapper.text()).not.toContain('43 символа. Код платформы')
      expect(code.attributes('aria-invalid')).toBe('true')
      expect(code.attributes('aria-describedby')).toMatch(/-error$/)
      wrapper.unmount()
    })

    it('пароль из 11 символов не отправляется, у поля ошибка; 12 проходит', async () => {
      modeIs('invite_only')
      const wrapper = mountForm()
      await settle()
      await wrapper.get('input[name="invite-code"]').setValue(CODE)
      await wrapper.get('input[name="name"]').setValue('Мария')
      await wrapper.get('input[name="email"]').setValue('maria@example.test')
      await wrapper.get('input[name="new-password"]').setValue('12345678901')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(register).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Не меньше 12 символов')
      expect(wrapper.get('input[name="new-password"]').attributes('aria-invalid')).toBe('true')
      wrapper.unmount()
    })

    it('адрес без @ — ошибка у почты, запрос не уходит', async () => {
      modeIs('invite_only')
      const wrapper = mountForm()
      await settle()
      await wrapper.get('input[name="invite-code"]').setValue(CODE)
      await wrapper.get('input[name="name"]').setValue('Мария')
      await wrapper.get('input[name="email"]').setValue('maria.example.test')
      await wrapper.get('input[name="new-password"]').setValue('very-secure-password')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(register).not.toHaveBeenCalled()
      expect(wrapper.get('input[name="email"]').attributes('aria-invalid')).toBe('true')
      wrapper.unmount()
    })

    it('имя из 200 букв принимается, из 201 — нет', async () => {
      modeIs('invite_only')
      vi.mocked(register).mockResolvedValue({ user: { id: 'u' } } as never)
      const submitWith = async (name: string) => {
        const wrapper = mountForm()
        await settle()
        await wrapper.get('input[name="invite-code"]').setValue(CODE)
        await wrapper.get('input[name="name"]').setValue(name)
        await wrapper.get('input[name="email"]').setValue('maria@example.test')
        await wrapper.get('input[name="new-password"]').setValue('very-secure-password')
        await wrapper.get('form').trigger('submit')
        await settle()
        const invalid = wrapper.get('input[name="name"]').attributes('aria-invalid')
        wrapper.unmount()
        return invalid
      }
      expect(await submitWith('я'.repeat(201))).toBe('true')
      expect(register).not.toHaveBeenCalled()
      expect(await submitWith('я'.repeat(200))).toBeUndefined()
      expect(register).toHaveBeenCalledTimes(1)
    })

    it('после ошибки сервера фокус возвращается к полю с ошибкой, а не остаётся на документе', async () => {
      modeIs('invite_only')
      vi.mocked(register).mockRejectedValue(
        new ApiError({ httpStatus: 409, code: 'EMAIL_ALREADY_REGISTERED' }),
      )
      const wrapper = mount(RegisterForm, {
        attachTo: document.body,
        global: {
          plugins: [
            [
              VueQueryPlugin,
              { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            ],
          ],
        },
      })
      await settle()
      await fillAndSubmit(wrapper, CODE)
      expect(document.activeElement).toBe(wrapper.get('input[name="email"]').element)
      // Клиентская ошибка: фокус на первом невалидном поле (код неверного формата).
      await wrapper.get('input[name="invite-code"]').setValue('short')
      await wrapper.get('form').trigger('submit')
      await settle()
      expect(document.activeElement).toBe(wrapper.get('input[name="invite-code"]').element)
      wrapper.unmount()
    })
  })
})
