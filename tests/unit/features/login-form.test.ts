import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/shared/api'
import { login, useSessionStore } from '@/entities/session'
import { LoginForm } from '@/features/auth-session'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

async function fill(wrapper: ReturnType<typeof mount>, email: string, password: string) {
  await wrapper.get('input[name="email"]').setValue(email)
  await wrapper.get('input[name="password"]').setValue(password)
}

/**
 * Отправляет форму и ждёт валидацию vee-validate и обработчик. Цепочка
 * содержит таймер, поэтому одних микрозадач недостаточно: нужна реальная пауза.
 */
async function submit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

describe('LoginForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
    vi.mocked(login).mockReset()
  })

  it('не отправляет пустую форму и показывает ошибки полей', async () => {
    const wrapper = mount(LoginForm)
    await submit(wrapper)
    expect(login).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Введите электронную почту')
    expect(wrapper.text()).toContain('Введите пароль')
    expect(wrapper.get('input[name="email"]').attributes('aria-invalid')).toBe('true')
    wrapper.unmount()
  })

  it('после успеха очищает пароль, перечитывает сессию и сообщает родителю', async () => {
    vi.mocked(login).mockResolvedValue({ user: { id: 'u' } } as never)
    const session = useSessionStore()
    const refresh = vi.spyOn(session, 'refresh').mockResolvedValue()
    const wrapper = mount(LoginForm)
    await fill(wrapper, 'owner@example.test', 'very-secure-password')
    await submit(wrapper)
    expect(login).toHaveBeenCalledWith({
      email: 'owner@example.test',
      password: 'very-secure-password',
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('401 даёт нейтральную ошибку без сведений о существовании адреса', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError({ httpStatus: 401, code: 'INVALID_CREDENTIALS', message: 'no such user' }),
    )
    const wrapper = mount(LoginForm)
    await fill(wrapper, 'owner@example.test', 'wrong-password-12')
    await submit(wrapper)
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Не удалось войти')
    expect(alert.text()).toContain('Проверьте электронную почту и пароль')
    expect(alert.text()).not.toContain('no such user')
    expect(wrapper.emitted('success')).toBeUndefined()
    wrapper.unmount()
  })

  it('сетевая ошибка не выдаётся за неверные реквизиты', async () => {
    vi.mocked(login).mockRejectedValue(ApiError.network(new TypeError('offline')))
    const wrapper = mount(LoginForm)
    await fill(wrapper, 'owner@example.test', 'very-secure-password')
    await submit(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('Нет связи с сервером')
    wrapper.unmount()
  })

  it('429 блокирует кнопку на серверное время ожидания', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError({ httpStatus: 429, code: 'RATE_LIMITED', retryAfterSeconds: 58 }),
    )
    const wrapper = mount(LoginForm)
    await fill(wrapper, 'owner@example.test', 'very-secure-password')
    await submit(wrapper)
    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('Войти через 58 с')
    expect(wrapper.get('[role="alert"]').text()).toContain('Слишком много попыток входа')
    expect(wrapper.get('[role="status"]').text()).toContain('58')
    await submit(wrapper)
    expect(login).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('кнопка показа пароля переключает тип поля и своё состояние', async () => {
    const wrapper = mount(LoginForm)
    const toggle = wrapper.get('button[aria-pressed]')
    expect(toggle.attributes('aria-label')).toBe('Показать пароль')
    await toggle.trigger('click')
    expect(wrapper.get('input[name="password"]').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Скрыть пароль')
    wrapper.unmount()
  })
})
