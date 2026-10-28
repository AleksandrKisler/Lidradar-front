import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
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
  const queryClient = new QueryClient()
  const wrapper = mount(component, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
  })
  await settle()
  return { wrapper, router, queryClient }
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
    expect(wrapper.get('h1').text()).toBe('Новый пароль')
    expect(wrapper.text()).toContain(
      'Все сеансы будут завершены. После смены войдите с новым паролем.',
    )
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
    expect(wrapper.get('h1').text()).toBe('Подтверждение почты')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    const retry = wrapper.findAll('button').find((button) => button.text() === 'Повторить проверку')
    await retry!.trigger('click')
    await settle()
    expect(verifyEmail).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Почта подтверждена')
    wrapper.unmount()
  })
})

describe('подтверждение почты: нет связи с сервером', () => {
  it('показывает «Нет соединения» из макета и повторяет проверку', async () => {
    vi.mocked(verifyEmail)
      .mockRejectedValueOnce(new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }))
      .mockResolvedValueOnce(undefined)
    vi.mocked(fetchMe).mockRejectedValue(Object.assign(new Error('401'), { httpStatus: 401 }))
    const { wrapper } = await mountAt(VerifyEmailPage, `/verify-email#token=${TOKEN}`)
    expect(wrapper.get('[role="alert"]').text()).toContain('Нет соединения')
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'Не удалось связаться с сервером. Проверьте подключение.',
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Повторить проверку')!
      .trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Почта подтверждена')
    wrapper.unmount()
  })
})

describe('страницы по ссылкам: красный признак отклонённой ссылки и каркасы загрузки', () => {
  it('ссылку без токена объясняет спокойно, отклонённую сервером — красной надписью и рамкой', async () => {
    const quiet = await mountAt(ResetPasswordPage, '/reset-password')
    expect(quiet.wrapper.html()).not.toContain('border-danger/25')
    expect(quiet.wrapper.get('p.text-meta').classes()).toContain('text-secondary')
    quiet.wrapper.unmount()

    vi.mocked(resetPassword).mockRejectedValue(apiError(400, 'RESET_TOKEN_INVALID'))
    const rejected = await mountAt(ResetPasswordPage, `/reset-password#token=${TOKEN}`)
    await rejected.wrapper.get('input[name="new-password"]').setValue('another-secure-password')
    await rejected.wrapper.get('input[name="confirm-password"]').setValue('another-secure-password')
    await rejected.wrapper.get('form').trigger('submit')
    await settle()
    expect(rejected.wrapper.html()).toContain('border-danger/25')
    expect(rejected.wrapper.get('p.text-meta').classes()).toContain('text-danger')
    expect(rejected.wrapper.get('h1').text()).toBe('Ссылка недействительна')
    rejected.wrapper.unmount()
  })

  it('кнопка «Запросить новую ссылку» занята, пока открывается страница запроса, и называется прежним именем', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/reset-password')
    await router.isReady()
    let finish: () => void = () => {}
    const slow = new Promise<void>((resolve) => (finish = resolve))
    router.beforeEach(async (to) => {
      if (to.name === 'forgot-password') await slow
    })
    const wrapper = mount(ResetPasswordPage, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await settle()
    const button = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Запросить новую ссылку'))!
    await button.trigger('click')
    await settle()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.text()).toContain('Открываем форму…')
    expect(button.get('.sr-only').text()).toBe('Запросить новую ссылку')
    finish()
    await settle()
    expect(router.currentRoute.value.name).toBe('forgot-password')
    wrapper.unmount()
  })

  it('первичная загрузка: с токеном — каркас формы, без токена — «Проверяем ссылку…»; токен из адреса не убирается и запросов нет', async () => {
    const withToken = await mountAtLoading(ResetPasswordPage, `#token=${TOKEN}`)
    expect(withToken.text()).toContain('Новый пароль')
    expect(withToken.find('input').exists()).toBe(false)
    withToken.unmount()
    const without = await mountAtLoading(ResetPasswordPage, '')
    expect(without.get('h1').text()).toBe('Проверяем ссылку…')
    expect(without.text()).toContain('Проверяем срок действия ссылки восстановления.')
    expect(without.find('button').exists()).toBe(false)
    without.unmount()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('подтверждение почты: каркас первой загрузки не отправляет подтверждение', async () => {
    const wrapper = await mountAtLoading(VerifyEmailPage, `#token=${TOKEN}`)
    expect(wrapper.get('h1').text()).toBe('Подтверждаем почту…')
    expect(wrapper.text()).toContain('Результат появится здесь автоматически.')
    expect(verifyEmail).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

async function mountAtLoading(component: object, hash: string) {
  window.history.replaceState(null, '', `/x${hash}`)
  const router = createRouter({ history: createMemoryHistory(), routes })
  const wrapper = mount(component, {
    props: { loading: true },
    global: { plugins: [router, [VueQueryPlugin, { queryClient: new QueryClient() }]] },
  })
  await settle()
  window.history.replaceState(null, '', '/')
  return wrapper
}

describe('вошедший пользователь на страницах сброса пароля', () => {
  async function submitReset(wrapper: ReturnType<typeof mount>) {
    await wrapper.get('input[name="new-password"]').setValue('another-secure-password')
    await wrapper.get('input[name="confirm-password"]').setValue('another-secure-password')
    await wrapper.get('form').trigger('submit')
    await settle()
  }
  const unauthenticated = Object.assign(new Error('401'), { httpStatus: 401 })

  it('после смены пароля сервер вернул 401: сессия и кэш очищены, вход открывается с «Пароль изменён», а не Radar', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    const session = await signIn('2026-10-13T08:00:00Z')
    expect(session.isAuthenticated).toBe(true)
    const { wrapper, router, queryClient } = await mountAt(
      ResetPasswordPage,
      `/reset-password#token=${TOKEN}`,
    )
    queryClient.setQueryData(['tenant', 'tenant-a', 'risks'], { secret: 'данные прежней сессии' })
    // Сервер завершил все сессии: следующая проверка сессии отвечает 401.
    vi.mocked(fetchMe).mockRejectedValue(unauthenticated)
    await submitReset(wrapper)
    expect(useSessionStore().isAuthenticated).toBe(false)
    expect(useSessionStore().signOutReason).toBeNull()
    expect(queryClient.getQueryData(['tenant', 'tenant-a', 'risks'])).toBeUndefined()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.reset).toBe('done')
    wrapper.unmount()
  })

  it('нет ответа сервера о сессии: завершение считается состоявшимся, локальная сессия очищается', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    await signIn('2026-10-13T08:00:00Z')
    const { wrapper, router } = await mountAt(ResetPasswordPage, `/reset-password#token=${TOKEN}`)
    vi.mocked(fetchMe).mockRejectedValue(new Error('network'))
    await submitReset(wrapper)
    expect(useSessionStore().isAuthenticated).toBe(false)
    expect(router.currentRoute.value.name).toBe('login')
    wrapper.unmount()
  })

  it('ссылка пришла на другой аккаунт: живая сессия этой вкладки не трогается и кэш остаётся', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    await signIn('2026-10-13T08:00:00Z')
    const { wrapper, queryClient } = await mountAt(
      ResetPasswordPage,
      `/reset-password#token=${TOKEN}`,
    )
    queryClient.setQueryData(['tenant', 'tenant-a', 'risks'], { keep: true })
    await submitReset(wrapper) // fetchMe по-прежнему отдаёт этого пользователя
    expect(useSessionStore().isAuthenticated).toBe(true)
    expect(queryClient.getQueryData(['tenant', 'tenant-a', 'risks'])).toEqual({ keep: true })
    wrapper.unmount()
  })

  it('отказ сервера (429, 5xx) сессию не трогает', async () => {
    for (const error of [apiError(429, 'RATE_LIMITED'), apiError(500, 'INTERNAL_ERROR')]) {
      setActivePinia(createPinia())
      vi.mocked(resetPassword).mockReset()
      vi.mocked(resetPassword).mockRejectedValue(error)
      await signIn('2026-10-13T08:00:00Z')
      const { wrapper } = await mountAt(ResetPasswordPage, `/reset-password#token=${TOKEN}`)
      await submitReset(wrapper)
      expect(useSessionStore().isAuthenticated).toBe(true)
      expect(wrapper.find('form').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('недействительная ссылка: вместо запроса письма (он только гостю) — настройки и «Продолжить работу», без «Запросите новое письмо»', async () => {
    await signIn('2026-10-13T08:00:00Z')
    const { wrapper, router } = await mountAt(ResetPasswordPage, '/reset-password')
    expect(wrapper.get('[data-testid="reset-link-signed-in"]').text()).toContain(
      'Настройки → Аккаунт',
    )
    expect(wrapper.text()).not.toContain('Запросить новую ссылку')
    expect(wrapper.text()).not.toContain('Запросите новое письмо')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Продолжить работу')!
      .trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('radar'), { timeout: 3000 })
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
    expect(wrapper.get('h1').text()).toBe('Восстановить пароль')
    expect(wrapper.text()).toContain('Укажите почту. Если адрес зарегистрирован')
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
