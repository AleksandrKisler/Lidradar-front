/** Выдача права администратора платформы: почта зарегистрированного пользователя и заметка. */
import * as v from 'valibot'

export const grantAdminSchema = v.object({
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите электронную почту'),
    v.email('Проверьте адрес электронной почты'),
    v.maxLength(254, 'Слишком длинный адрес'),
  ),
  note: v.pipe(v.string(), v.trim(), v.maxLength(500, 'Заметка не длиннее 500 символов')),
})

export type GrantAdminValues = v.InferOutput<typeof grantAdminSchema>
