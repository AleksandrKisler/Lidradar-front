import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api'
import {
  INVITATION_CONTEXT_KEY,
  INVITATION_CONTEXT_TTL_MS,
  isInvitationContextFresh,
  parseInvitationContext,
  readInvitationContext,
  writeInvitationContext,
  clearInvitationContext,
} from '@/features/auth-session/model/invitation-context'
import {
  FALLBACK_RETRY_SECONDS,
  classifyInvitationCheckError,
  classifyRegisterError,
} from '@/features/auth-session/model/registration-errors'
import { LogoutButton, checkInvitationCodeFormat, registerSchema } from '@/features/auth-session'
import { logout } from '@/entities/session'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import * as v from 'valibot'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/** Контекст приглашения вкладки (ADR 0067) и классификация ответов регистрации (ADR 0067/0068). */

const CODE = 'Syn7hetic-Code_aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const NOW = 1_800_000_000_000
const record = (checkedAt: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, code: CODE, checkedAt, ...extra })

describe('срок контекста: 30 минут от первой проверки', () => {
  it('граница: 29:59.999 действует, ровно 30:00 — истёк; будущее и NaN не принимаются', () => {
    expect(INVITATION_CONTEXT_TTL_MS).toBe(30 * 60_000)
    expect(isInvitationContextFresh(NOW - INVITATION_CONTEXT_TTL_MS + 1, NOW)).toBe(true)
    expect(isInvitationContextFresh(NOW - INVITATION_CONTEXT_TTL_MS, NOW)).toBe(false)
    expect(isInvitationContextFresh(NOW, NOW)).toBe(true)
    expect(isInvitationContextFresh(NOW + 1, NOW)).toBe(false)
    expect(isInvitationContextFresh(Number.NaN, NOW)).toBe(false)
    expect(isInvitationContextFresh(Number.POSITIVE_INFINITY, NOW)).toBe(false)
  })
})

describe('схема записи', () => {
  it('принимает только полную запись известной версии', () => {
    expect(parseInvitationContext(record(NOW - 1), NOW)).toEqual({ code: CODE, checkedAt: NOW - 1 })
    expect(parseInvitationContext(null, NOW)).toBeNull()
    for (const raw of [
      '',
      'null',
      '[]',
      '"text"',
      '{broken',
      JSON.stringify({ code: CODE, checkedAt: NOW }),
      JSON.stringify({ v: 2, code: CODE, checkedAt: NOW }),
      record(NOW, { email: 'maria@example.test' }),
      JSON.stringify({ v: 1, code: CODE.toLowerCase().slice(0, 42), checkedAt: NOW }),
      JSON.stringify({ v: 1, code: ` ${CODE}`, checkedAt: NOW }),
      JSON.stringify({ v: 1, code: 42, checkedAt: NOW }),
      record(String(NOW)),
      record(null),
      record(NOW + 1),
      record(NOW - INVITATION_CONTEXT_TTL_MS),
    ]) {
      expect(parseInvitationContext(raw, NOW), raw).toBeNull()
    }
  })
})

describe('хранилище вкладки', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('запись — только версия, код и время; без имени, почты и пароля', () => {
    expect(writeInvitationContext({ code: CODE, checkedAt: NOW })).toBe(true)
    expect(JSON.parse(sessionStorage.getItem(INVITATION_CONTEXT_KEY)!)).toEqual({
      v: 1,
      code: CODE,
      checkedAt: NOW,
    })
    expect(readInvitationContext(NOW + 1_000)).toEqual({ code: CODE, checkedAt: NOW })
    clearInvitationContext()
    expect(sessionStorage.getItem(INVITATION_CONTEXT_KEY)).toBeNull()
  })

  it('испорченная или истёкшая запись удаляется при чтении', () => {
    sessionStorage.setItem(INVITATION_CONTEXT_KEY, '{broken')
    expect(readInvitationContext(NOW)).toBeNull()
    expect(sessionStorage.getItem(INVITATION_CONTEXT_KEY)).toBeNull()
    writeInvitationContext({ code: CODE, checkedAt: NOW })
    expect(readInvitationContext(NOW + INVITATION_CONTEXT_TTL_MS)).toBeNull()
    expect(sessionStorage.getItem(INVITATION_CONTEXT_KEY)).toBeNull()
  })

  it('запрещённое хранилище — не ошибка: чтение пустое, запись сообщает о неудаче', () => {
    const proto = Object.getPrototypeOf(sessionStorage) as Storage
    const denied = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.spyOn(proto, 'getItem').mockImplementation(denied)
    vi.spyOn(proto, 'setItem').mockImplementation(denied)
    vi.spyOn(proto, 'removeItem').mockImplementation(denied)
    expect(readInvitationContext(NOW)).toBeNull()
    expect(writeInvitationContext({ code: CODE, checkedAt: NOW })).toBe(false)
    expect(() => clearInvitationContext()).not.toThrow()
  })

  it('в localStorage ничего не пишется', () => {
    localStorage.clear()
    writeInvitationContext({ code: CODE, checkedAt: NOW })
    expect(localStorage.length).toBe(0)
  })
})

describe('формат кода и данные аккаунта', () => {
  it('пробелы убираются, регистр сохраняется, ровно 43 символа base64url', () => {
    expect(checkInvitationCodeFormat(` ${CODE.slice(0, 10)}\t${CODE.slice(10)}\n`)).toEqual({
      code: CODE,
      problem: null,
    })
    expect(checkInvitationCodeFormat('   ').problem).toBe('empty')
    expect(checkInvitationCodeFormat(CODE.slice(0, 42)).problem).toBe('format')
    expect(checkInvitationCodeFormat(`${CODE}a`).problem).toBe('format')
    expect(checkInvitationCodeFormat(`${CODE.slice(0, 42)}ё`).problem).toBe('format')
    expect(checkInvitationCodeFormat(`${CODE.slice(0, 42)}=`).problem).toBe('format')
  })

  it('регистрация: имя 200 — да, 201 — нет; пароль 12–1024; точный текст неверной почты', () => {
    const ok = {
      displayName: 'я'.repeat(200),
      email: 'maria@example.test',
      password: 'p'.repeat(12),
    }
    expect(v.safeParse(registerSchema, ok).success).toBe(true)
    expect(v.safeParse(registerSchema, { ...ok, displayName: 'я'.repeat(201) }).success).toBe(false)
    expect(v.safeParse(registerSchema, { ...ok, displayName: '   ' }).success).toBe(false)
    expect(v.safeParse(registerSchema, { ...ok, password: 'p'.repeat(11) }).success).toBe(false)
    expect(v.safeParse(registerSchema, { ...ok, password: 'p'.repeat(1024) }).success).toBe(true)
    expect(v.safeParse(registerSchema, { ...ok, password: 'p'.repeat(1025) }).success).toBe(false)
    const email = v.safeParse(registerSchema, { ...ok, email: 'maria.example.test' })
    expect(email.success).toBe(false)
    expect(email.issues?.[0]?.message).toBe('Введите корректный адрес электронной почты.')
    // Код приглашения в данные аккаунта не входит.
    expect(Object.keys(registerSchema.entries).sort()).toEqual(['displayName', 'email', 'password'])
  })
})

describe('классификация ответа проверки кода', () => {
  const error = (httpStatus: number, code: string, retryAfterSeconds?: number) =>
    new ApiError({ httpStatus, code, retryAfterSeconds })

  it('только 403 INVITATION_INVALID — непригодный код', () => {
    expect(classifyInvitationCheckError(error(403, 'INVITATION_INVALID'))).toEqual({
      kind: 'invalid',
    })
    for (const failure of [
      error(400, 'INVALID_ARGUMENT'),
      error(403, 'ORIGIN_NOT_ALLOWED'),
      error(401, 'UNAUTHENTICATED'),
      error(404, 'ROUTE_NOT_FOUND'),
      error(400, 'INVITATION_INVALID'),
      error(500, 'INTERNAL_ERROR'),
      error(0, 'NETWORK_ERROR'),
      new Error('boom'),
    ]) {
      expect(classifyInvitationCheckError(failure)).toEqual({ kind: 'service' })
    }
  })

  it('429: секунды Retry-After или запасные 60', () => {
    expect(classifyInvitationCheckError(error(429, 'RATE_LIMITED', 17))).toEqual({
      kind: 'rate-limited',
      seconds: 17,
    })
    for (const value of [undefined, 0, Number.NaN]) {
      expect(classifyInvitationCheckError(error(429, 'RATE_LIMITED', value))).toEqual({
        kind: 'rate-limited',
        seconds: FALLBACK_RETRY_SECONDS,
      })
    }
  })
})

describe('классификация ответа регистрации', () => {
  const kind = (failure: unknown) => classifyRegisterError(failure).kind

  it('нейтральный отказ — только два согласованных кода, а не все 400/409', () => {
    expect(kind(new ApiError({ httpStatus: 400, code: 'REGISTRATION_FAILED' }))).toBe('rejected')
    expect(kind(new ApiError({ httpStatus: 409, code: 'EMAIL_ALREADY_REGISTERED' }))).toBe(
      'rejected',
    )
    expect(kind(new ApiError({ httpStatus: 400, code: 'INVALID_ARGUMENT' }))).toBe('failed')
    expect(kind(new ApiError({ httpStatus: 409, code: 'CONFLICT' }))).toBe('failed')
  })

  it('приглашение, режим, лимит и неизвестный исход различаются', () => {
    expect(kind(new ApiError({ httpStatus: 403, code: 'INVITATION_INVALID' }))).toBe(
      'invitation-invalid',
    )
    expect(kind(new ApiError({ httpStatus: 403, code: 'INVITATION_REQUIRED' }))).toBe(
      'invitation-required',
    )
    expect(kind(new ApiError({ httpStatus: 403, code: 'ORIGIN_NOT_ALLOWED' }))).toBe('failed')
    expect(classifyRegisterError(new ApiError({ httpStatus: 429, code: 'RATE_LIMITED' }))).toEqual({
      kind: 'rate-limited',
      seconds: FALLBACK_RETRY_SECONDS,
    })
    expect(kind(new ApiError({ httpStatus: 0, code: 'NETWORK_ERROR' }))).toBe('unknown-outcome')
    expect(kind(new ApiError({ httpStatus: 503, code: 'SERVICE_NOT_READY' }))).toBe(
      'unknown-outcome',
    )
    expect(kind(new TypeError('aborted'))).toBe('unknown-outcome')
  })
})

describe('выход очищает контекст приглашения вкладки (AC-B15)', () => {
  it.each([
    ['сервер подтвердил', () => vi.mocked(logout).mockResolvedValue()],
    ['сеть', () => vi.mocked(logout).mockRejectedValue(new TypeError('offline'))],
  ])('%s', async (_name, arrange) => {
    arrange()
    setActivePinia(createPinia())
    writeInvitationContext({ code: CODE, checkedAt: Date.now() })
    const wrapper = mount(LogoutButton, {
      global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(sessionStorage.getItem(INVITATION_CONTEXT_KEY)).toBeNull()
    expect(wrapper.emitted('loggedOut')).toHaveLength(1)
    wrapper.unmount()
  })
})
