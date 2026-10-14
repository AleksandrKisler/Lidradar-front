import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiError } from '@/shared/api'
import { changePassword, requestPasswordReset, resetPassword } from '@/entities/session'
import { ChangePasswordForm, ForgotPasswordForm, ResetPasswordForm } from '@/features/auth-session'

vi.mock('@/entities/session/api/account-api', () => ({
  changePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  resendEmailVerification: vi.fn(),
  verifyEmail: vi.fn(),
}))
vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/** Формы сброса и смены пароля (ADR 0058): проверка до запроса, ответы сервера, пределы. */

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW'
const PASSWORD = 'very-secure-password'
const NEW_PASSWORD = 'another-secure-password'

const apiError = (httpStatus: number, code: string, retryAfterSeconds?: number) =>
  new ApiError({ httpStatus, code, traceId: 't-1', retryAfterSeconds })

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(changePassword).mockReset()
  vi.mocked(requestPasswordReset).mockReset()
  vi.mocked(resetPassword).mockReset()
})

describe('ForgotPasswordForm', () => {
  async function submit(wrapper: ReturnType<typeof mountForm>, email: string) {
    await wrapper.get('input[name="email"]').setValue(email)
    await wrapper.get('form').trigger('submit')
    await settle()
  }
  const mountForm = () => mount(ForgotPasswordForm)

  it('не отправляет запрос с неверно записанным адресом', async () => {
    const wrapper = mountForm()
    await submit(wrapper, 'not-an-address')
    expect(requestPasswordReset).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Проверьте формат электронной почты')
    wrapper.unmount()
  })

  it('отправляет адрес без пробелов и всегда отвечает «если адрес зарегистрирован»', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined)
    const wrapper = mountForm()
    await submit(wrapper, '  owner@example.test ')
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'owner@example.test' })
    const done = wrapper.get('[data-testid="reset-requested"]')
    expect(done.text()).toContain('Если адрес')
    expect(done.text()).toContain('owner@example.test')
    expect(done.text()).toContain('60 минут')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.emitted('sent')).toHaveLength(1)
    wrapper.unmount()
  })

  it('«Ввести другой адрес» возвращает пустую форму', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined)
    const wrapper = mountForm()
    await submit(wrapper, 'owner@example.test')
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.find('form').exists()).toBe(true)
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('после предела сервера показывает отсчёт и не шлёт второй запрос', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(apiError(429, 'RATE_LIMITED', 3600))
    const wrapper = mountForm()
    await submit(wrapper, 'owner@example.test')
    expect(wrapper.text()).toContain('Слишком много запросов')
    expect(wrapper.text()).toContain('60 мин')
    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(requestPasswordReset).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('показывает ошибку сервера и оставляет форму для повтора', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))
    const wrapper = mountForm()
    await submit(wrapper, 'owner@example.test')
    expect(wrapper.text()).toContain('Внутренняя ошибка сервера')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-requested"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ResetPasswordForm', () => {
  const mountForm = () => mount(ResetPasswordForm, { props: { token: TOKEN } })
  async function submit(
    wrapper: ReturnType<typeof mountForm>,
    password: string,
    repeat = password,
  ) {
    await wrapper.get('input[name="new-password"]').setValue(password)
    await wrapper.get('input[name="confirm-password"]').setValue(repeat)
    await wrapper.get('form').trigger('submit')
    await settle()
  }

  it('требует совпадения паролей и минимальной длины до запроса', async () => {
    const wrapper = mountForm()
    await submit(wrapper, PASSWORD, 'other-secure-password')
    expect(resetPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Пароли не совпадают')
    await submit(wrapper, 'short', 'short')
    expect(resetPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Не меньше 12 символов')
    wrapper.unmount()
  })

  it('отправляет токен и новый пароль, очищает поля и сообщает родителю', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    const wrapper = mountForm()
    await submit(wrapper, NEW_PASSWORD)
    expect(resetPassword).toHaveBeenCalledWith({ token: TOKEN, newPassword: NEW_PASSWORD })
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect((wrapper.get('input[name="new-password"]').element as HTMLInputElement).value).toBe('')
    expect((wrapper.get('input[name="confirm-password"]').element as HTMLInputElement).value).toBe(
      '',
    )
    wrapper.unmount()
  })

  it('недействительную ссылку сообщает родителю и не оставляет введённый пароль', async () => {
    vi.mocked(resetPassword).mockRejectedValue(apiError(400, 'RESET_TOKEN_INVALID'))
    const wrapper = mountForm()
    await submit(wrapper, NEW_PASSWORD)
    expect(wrapper.emitted('invalid')).toHaveLength(1)
    expect(wrapper.emitted('done')).toBeUndefined()
    expect((wrapper.get('input[name="new-password"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('отказ сервера по паролю показывается в форме и не считается недействительной ссылкой', async () => {
    vi.mocked(resetPassword).mockRejectedValue(apiError(400, 'INVALID_ARGUMENT'))
    const wrapper = mountForm()
    await submit(wrapper, NEW_PASSWORD)
    expect(wrapper.text()).toContain('Данные не приняты')
    expect(wrapper.emitted('invalid')).toBeUndefined()
    expect(wrapper.emitted('done')).toBeUndefined()
    wrapper.unmount()
  })

  it('после предела сервера показывает отсчёт и блокирует отправку', async () => {
    vi.mocked(resetPassword).mockRejectedValue(apiError(429, 'RATE_LIMITED', 600))
    const wrapper = mountForm()
    await submit(wrapper, NEW_PASSWORD)
    expect(wrapper.text()).toContain('Слишком много попыток')
    expect(wrapper.text()).toContain('10 мин')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})

describe('ChangePasswordForm', () => {
  const mountForm = () => mount(ChangePasswordForm)
  async function submit(
    wrapper: ReturnType<typeof mountForm>,
    values: { current?: string; next?: string; repeat?: string },
  ) {
    await wrapper.get('input[name="current-password"]').setValue(values.current ?? PASSWORD)
    await wrapper.get('input[name="new-password"]').setValue(values.next ?? NEW_PASSWORD)
    await wrapper
      .get('input[name="confirm-password"]')
      .setValue(values.repeat ?? values.next ?? NEW_PASSWORD)
    await wrapper.get('form').trigger('submit')
    await settle()
  }

  it('проверяет поля до запроса', async () => {
    const wrapper = mountForm()
    await submit(wrapper, { current: '' })
    expect(wrapper.text()).toContain('Введите текущий пароль')
    await submit(wrapper, { next: PASSWORD })
    expect(wrapper.text()).toContain('Новый пароль должен отличаться от текущего')
    await submit(wrapper, { repeat: 'something-else-entirely' })
    expect(wrapper.text()).toContain('Пароли не совпадают')
    await submit(wrapper, { next: 'short' })
    expect(wrapper.text()).toContain('Не меньше 12 символов')
    expect(changePassword).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('отправляет оба пароля, очищает поля и объясняет, что остальные устройства вышли', async () => {
    vi.mocked(changePassword).mockResolvedValue(undefined)
    const wrapper = mountForm()
    await submit(wrapper, {})
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    })
    expect(wrapper.text()).toContain('Пароль изменён')
    expect(wrapper.text()).toContain('На остальных устройствах вы вышли из аккаунта')
    for (const name of ['current-password', 'new-password', 'confirm-password']) {
      expect((wrapper.get(`input[name="${name}"]`).element as HTMLInputElement).value).toBe('')
    }
    expect(wrapper.emitted('changed')).toHaveLength(1)
    wrapper.unmount()
  })

  it('неверный текущий пароль показывается у поля и не выглядит потерей сессии', async () => {
    vi.mocked(changePassword).mockRejectedValue(apiError(403, 'INVALID_CURRENT_PASSWORD'))
    const wrapper = mountForm()
    await submit(wrapper, {})
    const field = wrapper.get('input[name="current-password"]')
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('Текущий пароль не подошёл')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false) // общей ошибки нет: это ошибка поля
    expect(wrapper.text()).not.toContain('Пароль изменён')
    // Введённое сохраняется, чтобы исправить опечатку, а не набирать всё заново.
    expect((wrapper.get('input[name="new-password"]').element as HTMLInputElement).value).toBe(
      NEW_PASSWORD,
    )
    wrapper.unmount()
  })

  it('после предела в 5 попыток показывает отсчёт и не шлёт запрос', async () => {
    vi.mocked(changePassword).mockRejectedValue(apiError(429, 'RATE_LIMITED', 900))
    const wrapper = mountForm()
    await submit(wrapper, {})
    expect(wrapper.text()).toContain('Слишком много попыток')
    expect(wrapper.text()).toContain('15 мин')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(changePassword).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('прочие ошибки показываются общим сообщением, пароли остаются в форме', async () => {
    vi.mocked(changePassword).mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))
    const wrapper = mountForm()
    await submit(wrapper, {})
    expect(wrapper.find('[role="alert"]').text()).toContain('Внутренняя ошибка сервера')
    expect(wrapper.emitted('changed')).toBeUndefined()
    wrapper.unmount()
  })
})
