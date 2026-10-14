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

export const registerSchema = v.object({
  email,
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
  /**
   * Код платформы или код сотрудника (ADR 0057). Формат проверяется здесь, чтобы опечатка не расходовала
   * попытку: на сервере регистрации с адреса ограничены пятью в час. Обязательность зависит от режима
   * сервера и проверяется формой.
   */
  inviteCode: v.pipe(
    v.string(),
    v.transform(normalizeInvitationCode),
    v.check(
      (value) => value === '' || INVITATION_CODE_PATTERN.test(value),
      'Код состоит из 43 символов: латиница, цифры, «-» и «_»',
    ),
  ),
})

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
