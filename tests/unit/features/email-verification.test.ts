import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/shared/api'
import { fetchMe, resendEmailVerification, useSessionStore } from '@/entities/session'
import { EmailVerificationBanner, ResendVerificationButton } from '@/features/auth-session'

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

/** Напоминание о неподтверждённой почте и повторное письмо (ADR 0058): подтверждение мягкое, ничего не блокирует. */

const apiError = (httpStatus: number, code: string, retryAfterSeconds?: number) =>
  new ApiError({ httpStatus, code, traceId: 't-1', retryAfterSeconds })

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

type Verified = string | null | undefined

async function signIn(emailVerifiedAt: Verified, id = 'user-1') {
  const user = {
    id,
    email: 'owner@example.test',
    displayName: 'Мария',
    status: 'ACTIVE' as const,
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
    ...(emailVerifiedAt === undefined ? {} : { emailVerifiedAt }),
  }
  vi.mocked(fetchMe).mockResolvedValue({
    user: user as never,
    memberships: [],
    canCreateOrganization: false,
  })
  const session = useSessionStore()
  await session.bootstrap()
  return session
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  vi.mocked(fetchMe).mockReset()
  vi.mocked(resendEmailVerification).mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('EmailVerificationBanner', () => {
  it('показывается только когда сервер явно сообщил «не подтверждена»', async () => {
    await signIn(null)
    const wrapper = mount(EmailVerificationBanner)
    const banner = wrapper.get('[data-testid="email-verification-banner"]')
    expect(banner.text()).toContain('owner@example.test')
    expect(banner.text()).toContain('Пока можно работать как обычно')
    wrapper.unmount()
  })

  it('не показывается подтверждённому адресу, неизвестному значению и гостю', async () => {
    for (const verified of ['2026-10-13T08:00:00Z', undefined] as const) {
      setActivePinia(createPinia())
      await signIn(verified)
      const wrapper = mount(EmailVerificationBanner)
      expect(
        wrapper.find('[data-testid="email-verification-banner"]').exists(),
        String(verified),
      ).toBe(false)
      wrapper.unmount()
    }
    setActivePinia(createPinia())
    const guest = mount(EmailVerificationBanner) // сессия не загружена
    expect(guest.find('[data-testid="email-verification-banner"]').exists()).toBe(false)
    guest.unmount()
  })

  it('«Скрыть» убирает напоминание на время сессии браузера и только для этого пользователя', async () => {
    await signIn(null, 'user-1')
    const first = mount(EmailVerificationBanner)
    const dismiss = first.findAll('button').find((button) => button.text() === 'Скрыть')
    expect(dismiss).toBeDefined()
    await dismiss!.trigger('click')
    expect(first.find('[data-testid="email-verification-banner"]').exists()).toBe(false)
    first.unmount()

    // После «перезагрузки» напоминание остаётся скрытым.
    const second = mount(EmailVerificationBanner)
    expect(second.find('[data-testid="email-verification-banner"]').exists()).toBe(false)
    second.unmount()

    // Другой пользователь в том же браузере напоминание видит.
    setActivePinia(createPinia())
    await signIn(null, 'user-2')
    const other = mount(EmailVerificationBanner)
    expect(other.find('[data-testid="email-verification-banner"]').exists()).toBe(true)
    other.unmount()
  })

  it('недоступное хранилище браузера не ломает напоминание', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    await signIn(null)
    const wrapper = mount(EmailVerificationBanner)
    expect(wrapper.find('[data-testid="email-verification-banner"]').exists()).toBe(true)
    const dismiss = wrapper.findAll('button').find((button) => button.text() === 'Скрыть')
    await dismiss?.trigger('click')
    expect(wrapper.find('[data-testid="email-verification-banner"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('исчезает, когда сессия перечитана и адрес подтверждён', async () => {
    const session = await signIn(null)
    const wrapper = mount(EmailVerificationBanner)
    expect(wrapper.find('[data-testid="email-verification-banner"]').exists()).toBe(true)
    await signIn('2026-10-13T08:00:00Z')
    await session.refresh()
    await settle()
    expect(wrapper.find('[data-testid="email-verification-banner"]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('ResendVerificationButton', () => {
  const mountButton = () => mount(ResendVerificationButton)

  it('просит письмо один раз и подтверждает отправку', async () => {
    vi.mocked(resendEmailVerification).mockResolvedValue(undefined)
    const wrapper = mountButton()
    await wrapper.get('button').trigger('click')
    await settle()
    expect(resendEmailVerification).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Письмо отправлено')
    expect(wrapper.emitted('sent')).toHaveLength(1)
    wrapper.unmount()
  })

  it('после предела в три письма в час показывает отсчёт и блокирует кнопку', async () => {
    vi.mocked(resendEmailVerification).mockRejectedValue(apiError(429, 'RATE_LIMITED', 3000))
    const wrapper = mountButton()
    await wrapper.get('button').trigger('click')
    await settle()
    const button = wrapper.get('button')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('50 мин')
    expect(wrapper.text()).toContain('не больше трёх в час')
    await button.trigger('click')
    expect(resendEmailVerification).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('спокойно сообщает, что почта на сервере не настроена', async () => {
    vi.mocked(resendEmailVerification).mockRejectedValue(apiError(503, 'MAIL_UNAVAILABLE'))
    const wrapper = mountButton()
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Отправка писем сейчас недоступна')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('прочие сбои показываются кратко и позволяют повторить', async () => {
    vi.mocked(resendEmailVerification).mockRejectedValue(apiError(500, 'INTERNAL_ERROR'))
    const wrapper = mountButton()
    await wrapper.get('button').trigger('click')
    await settle()
    expect(wrapper.find('[role="alert"]').text()).toContain('Не удалось отправить письмо')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
