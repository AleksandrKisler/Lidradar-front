/**
 * Схемы форм входа и регистрации.
 *
 * Локально проверяются только очевидные ограничения контракта (формат почты,
 * длина пароля). Окончательное решение принимает сервер: форма должна
 * корректно показать его ответ, а не предугадывать его.
 */
import * as v from 'valibot'
import { INVITATION_CODE_PATTERN, normalizeInvitationCode } from '@/entities/team'

const email = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Введите электронную почту'),
  v.maxLength(254, 'Слишком длинный адрес'),
  v.email('Проверьте формат электронной почты'),
)

export const loginSchema = v.object({
  email,
  password: v.pipe(
    v.string(),
    v.nonEmpty('Введите пароль'),
    v.maxLength(1024, 'Слишком длинный пароль'),
  ),
})

export type LoginValues = v.InferOutput<typeof loginSchema>

/** Минимальная длина пароля по контракту регистрации. */
export const PASSWORD_MIN_LENGTH = 12

/**
 * Данные аккаунта (US-M01-01 AC-G03): имя, почта и пароль. Код приглашения в эту форму не входит —
 * его проверяет отдельный шаг, а форма получает уже проверенный контекст. Текст ошибки адреса —
 * только для регистрации: формы входа и сброса пароля сохраняют свои подписи.
 */
export const registerSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите электронную почту'),
    v.maxLength(254, 'Слишком длинный адрес'),
    v.email('Введите корректный адрес электронной почты.'),
  ),
  displayName: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите имя'),
    v.maxLength(200, 'Слишком длинное имя'),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(PASSWORD_MIN_LENGTH, `Не меньше ${PASSWORD_MIN_LENGTH} символов`),
    v.maxLength(1024, 'Слишком длинный пароль'),
  ),
})

/** Тексты локальной проверки кода приглашения (US-M01-01 AC-B03). */
export const INVITATION_CODE_MESSAGES = {
  empty: 'Для регистрации нужен код приглашения',
  format: 'Код состоит из 43 символов: латиница, цифры, «-» и «_»',
} as const

/**
 * Локальная проверка кода приглашения без запроса: пробелы убираются, регистр сохраняется
 * (правила кодов команды — `normalizeInvitationCode`, `INVITATION_CODE_PATTERN`). Формат не
 * доказывает пригодность: её подтверждает только сервер.
 */
export function checkInvitationCodeFormat(raw: string): {
  code: string
  problem: keyof typeof INVITATION_CODE_MESSAGES | null
} {
  const code = normalizeInvitationCode(raw)
  if (code === '') return { code, problem: 'empty' }
  return { code, problem: INVITATION_CODE_PATTERN.test(code) ? null : 'format' }
}

export type RegisterValues = v.InferOutput<typeof registerSchema>

/** Новый пароль: те же границы, что у регистрации. */
const newPassword = v.pipe(
  v.string(),
  v.minLength(PASSWORD_MIN_LENGTH, `Не меньше ${PASSWORD_MIN_LENGTH} символов`),
  v.maxLength(1024, 'Слишком длинный пароль'),
)

/** Запрос письма сброса (ADR 0058): достаточно адреса; ответ сервера не зависит от его существования. */
export const forgotPasswordSchema = v.object({ email })

export type ForgotPasswordValues = v.InferOutput<typeof forgotPasswordSchema>

/** Новый пароль по ссылке из письма; повтор нужен, чтобы опечатка не закрыла доступ к аккаунту. */
export const resetPasswordSchema = v.pipe(
  v.object({ password: newPassword, confirmation: v.string() }),
  v.forward(
    v.check((values) => values.password === values.confirmation, 'Пароли не совпадают'),
    ['confirmation'],
  ),
)

export type ResetPasswordValues = v.InferOutput<typeof resetPasswordSchema>

/** Смена пароля: текущий пароль подтверждает владельца сессии, новый отличается от него. */
export const changePasswordSchema = v.pipe(
  v.object({
    currentPassword: v.pipe(
      v.string(),
      v.nonEmpty('Введите текущий пароль'),
      v.maxLength(1024, 'Слишком длинный пароль'),
    ),
    password: newPassword,
    confirmation: v.string(),
  }),
  v.forward(
    v.check(
      (values) => values.password !== values.currentPassword,
      'Новый пароль должен отличаться от текущего',
    ),
    ['password'],
  ),
  v.forward(
    v.check((values) => values.password === values.confirmation, 'Пароли не совпадают'),
    ['confirmation'],
  ),
)

export type ChangePasswordValues = v.InferOutput<typeof changePasswordSchema>
