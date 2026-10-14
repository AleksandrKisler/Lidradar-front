import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/shared/api'
import { routes } from '@/app/router/routes'
import {
  fetchMe,
  resendEmailVerification,
  resetPassword,
  useSessionStore,
  verifyEmail,
} from '@/entities/session'
import { ForgotPasswordPage } from '@/pages/forgot-password'
import { LoginPage } from '@/pages/login'
import { ResetPasswordPage } from '@/pages/reset-password'
import { SettingsAccountPage } from '@/pages/settings'
import { VerifyEmailPage } from '@/pages/verify-email'

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

/**
 * Страницы по ссылкам из писем (ADR 0058): токен читается из фрагмента один раз и убирается из адреса,
 * неверная ссылка объясняется без запроса, результат ведёт к понятному следующему шагу.
 */

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW'
const apiError = (httpStatus: number, code: string) =>
  new ApiError({ httpStatus, code, traceId: 't-1' })

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

async function signIn(emailVerifiedAt: string | null) {
  vi.mocked(fetchMe).mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'owner@example.test',
      displayName: 'Мария',
      status: 'ACTIVE',
      createdAt: '2026-10-13T00:00:00Z',
      updatedAt: '2026-10-13T00:00:00Z',
      emailVerifiedAt,
      deletionDueAt: null,
    },
    memberships: [{ tenantId: 'tenant-a', organizationName: 'Студия', role: 'OWNER' }],
    canCreateOrganization: false,
  })
  const session = useSessionStore()
  await session.bootstrap()
  session.selectTenant('tenant-a')
  return session
}

async function mountAt(component: object, path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, { global: { plugins: [router] } })
  await settle()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  vi.mocked(fetchMe).mockReset()
  vi.mocked(resetPassword).mockReset()
  vi.mocked(verifyEmail).mockReset()
  vi.mocked(resendEmailVerification).mockReset()
})

describe('страница нового пароля', () => {
  it('читает токен из фрагмента, убирает его из адреса и показывает форму', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper, router } = await mountAt(
      ResetPasswordPage,
      `/reset-password?x=1#token=${TOKEN}`,
    )
    expect(wrapper.find('input[name="new-password"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Придумайте новый пароль')
    expect(router.currentRoute.value.hash).toBe('')
    expect(router.currentRoute.value.fullPath).not.toContain(TOKEN)
    expect(router.currentRoute.value.query.x).toBe('1') // прочие параметры остаются
    wrapper.unmount()
  })

  it('после успеха ведёт на вход с пометкой, не входя сам', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    const { wrapper, router } = await mountAt(ResetPasswordPage, `/reset-password#token=${TOKEN}`)
    await wrapper.get('input[name="new-password"]').setValue('another-secure-password')
    await wrapper.get('input[name="confirm-password"]').setValue('another-secure-password')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(resetPassword).toHaveBeenCalledWith({
      token: TOKEN,
      newPassword: 'another-secure-password',
    })
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.reset).toBe('done')
    expect(fetchMe).not.toHaveBeenCalled() // входа нет: сессии пользователя завершены сервером
    wrapper.unmount()
  })

  it('без токена и с токеном неверного формата объясняет ссылку и не обращается к серверу', async () => {
    for (const path of [
      '/reset-password',
      '/reset-password#token=short',
      `/reset-password#token=${TOKEN}x`,
    ]) {
      const { wrapper } = await mountAt(ResetPasswordPage, path)
      expect(wrapper.get('[data-testid="reset-link-invalid"]').text()).toContain('Ссылка устарела')
      expect(wrapper.find('form').exists(), path).toBe(false)
      wrapper.unmount()
    }
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('когда сервер отверг ссылку, показывает то же объяснение и ведёт к новому письму', async () => {
    vi.mocked(resetPassword).mockRejectedValue(apiError(400, 'RESET_TOKEN_INVALID'))
    const { wrapper, router } = await mountAt(ResetPasswordPage, `/reset-password#token=${TOKEN}`)
    await wrapper.get('input[name="new-password"]').setValue('another-secure-password')
    await wrapper.get('input[name="confirm-password"]').setValue('another-secure-password')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.find('[data-testid="reset-link-invalid"]').exists()).toBe(true)
    expect(wrapper.find('form').exists()).toBe(false)
    const request = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Запросить новую ссылку'))
    await request!.trigger('click')
    await settle()
    expect(router.currentRoute.value.name).toBe('forgot-password')
    wrapper.unmount()
  })
})

describe('страница подтверждения почты', () => {
  it('гостю подтверждает адрес по токену и предлагает войти', async () => {
    vi.mocked(verifyEmail).mockResolvedValue(undefined)
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper, router } = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(verifyEmail).toHaveBeenCalledWith({ token: TOKEN })
    expect(wrapper.get('[data-testid="verify-done"]').text()).toContain('Спасибо')
    expect(wrapper.text()).toContain('Почта подтверждена')
    expect(router.currentRoute.value.fullPath).not.toContain(TOKEN)
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Войти')
    wrapper.unmount()
  })

  it('вошедшему перечитывает сессию, и напоминание о почте исчезает', async () => {
    vi.mocked(verifyEmail).mockResolvedValue(undefined)
    const session = await signIn(null)
    expect(session.emailUnverified).toBe(true)
    await signIn('2026-10-13T08:00:00Z') // ответ сервера после подтверждения
    vi.mocked(fetchMe).mockClear()
    const { wrapper } = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(fetchMe).toHaveBeenCalledTimes(1)
    expect(useSessionStore().emailUnverified).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Продолжить работу')
    wrapper.unmount()
  })

  it('без токена и с неверным токеном не обращается к серверу', async () => {
    for (const path of ['/verify-email', '/verify-email#token=nope']) {
      const { wrapper } = await mountAt(VerifyEmailPage, path)
      expect(wrapper.find('[data-testid="verify-invalid"]').exists(), path).toBe(true)
      wrapper.unmount()
    }
    expect(verifyEmail).not.toHaveBeenCalled()
  })

  it('отвергнутую ссылку гостю объясняет, вошедшему с неподтверждённой почтой даёт запросить новую', async () => {
    vi.mocked(verifyEmail).mockRejectedValue(apiError(400, 'VERIFICATION_TOKEN_INVALID'))
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const guest = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(guest.wrapper.get('[data-testid="verify-invalid"]').text()).toContain('Ссылка устарела')
    expect(guest.wrapper.text()).toContain('Настройки → Аккаунт')
    guest.wrapper.unmount()

    setActivePinia(createPinia())
    await signIn(null)
    const unverified = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(unverified.wrapper.text()).toContain('Отправить письмо ещё раз')
    unverified.wrapper.unmount()

    setActivePinia(createPinia())
    await signIn('2026-10-13T08:00:00Z')
    const verified = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(verified.wrapper.text()).toContain('Ваш адрес уже подтверждён')
    expect(verified.wrapper.text()).not.toContain('Отправить письмо ещё раз')
    verified.wrapper.unmount()
  })

  it('при сбое сервера показывает ошибку и позволяет повторить', async () => {
    vi.mocked(verifyEmail)
      .mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR'))
      .mockResolvedValueOnce(undefined)
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper } = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(wrapper.text()).toContain('Не удалось подтвердить')
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Повторить')
    await retry!.trigger('click')
    await settle()
    expect(verifyEmail).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Почта подтверждена')
    wrapper.unmount()
  })
})

describe('вход и восстановление', () => {
  it('на странице входа есть ссылка «Забыли пароль?»', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper } = await mountAt(LoginPage, '/login')
    const link = wrapper.find('a[href="/forgot-password"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Забыли пароль?')
    expect(wrapper.text()).not.toContain('Пароль изменён')
    wrapper.unmount()
  })

  it('после сброса пароля вход сообщает, что нужно войти новым паролем', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper } = await mountAt(LoginPage, '/login?reset=done')
    expect(wrapper.text()).toContain('Пароль изменён')
    expect(wrapper.text()).toContain('Войдите с новым паролем')
    wrapper.unmount()
  })

  it('страница восстановления показывает форму запроса письма', async () => {
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper } = await mountAt(ForgotPasswordPage, '/forgot-password')
    expect(wrapper.text()).toContain('Забыли пароль?')
    expect(wrapper.find('input[name="email"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('раздел «Аккаунт» в настройках', () => {
  it('неподтверждённой почте предлагает письмо и честно говорит, что работа не зависит от подтверждения', async () => {
    await signIn(null)
    const { wrapper } = await mountAt(SettingsAccountPage, '/settings/account')
    expect(wrapper.get('[data-testid="account-email"]').text()).toBe('owner@example.test')
    expect(wrapper.text()).toContain('Не подтверждена')
    expect(wrapper.text()).toContain('сервис работает и без него')
    expect(wrapper.text()).toContain('Отправить письмо ещё раз')
    expect(wrapper.find('input[name="current-password"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('подтверждённой почте письмо не предлагает', async () => {
    await signIn('2026-10-13T08:00:00Z')
    const { wrapper } = await mountAt(SettingsAccountPage, '/settings/account')
    expect(wrapper.text()).toContain('Подтверждена')
    expect(wrapper.text()).toContain('Адрес подтверждён')
    expect(wrapper.text()).not.toContain('Отправить письмо ещё раз')
    wrapper.unmount()
  })
})
