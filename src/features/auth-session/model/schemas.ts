/**
 * Схемы форм входа и регистрации.
 *
 * Локально проверяются только очевидные ограничения контракта (формат почты,
 * длина пароля). Окончательное решение принимает сервер: форма должна
 * корректно показать его ответ, а не предугадывать его.
 */
import * as v from 'valibot'

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
})

export type RegisterValues = v.InferOutput<typeof registerSchema>
