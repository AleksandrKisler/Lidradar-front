/**
 * Токен из ссылки письма (ADR 0058).
 *
 * Ссылки сброса пароля и подтверждения почты несут токен во фрагменте
 * (`/reset-password#token=…`): фрагмент не уходит на сервер и не попадает в
 * журналы прокси. Страница читает его один раз и сразу убирает из адреса, чтобы
 * он не остался в истории браузера. Формат токена — 256 бит в base64url без
 * дополнения (43 символа); неверный формат отсекается до запроса, чтобы
 * опечатка не расходовала предел попыток с адреса.
 */

/** Формат токена учётной записи, как на сервере. */
export const ACCOUNT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

/**
 * Достаёт токен из фрагмента адреса (`#token=…`). Возвращает `null`, если токена нет или
 * он неверного формата: странице нечего отправлять на сервер.
 */
export function readFragmentToken(hash: string): string | null {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (fragment === '') return null
  let token: string | null
  try {
    token = new URLSearchParams(fragment).get('token')
  } catch {
    return null
  }
  if (token === null) return null
  const trimmed = token.trim()
  return ACCOUNT_TOKEN_PATTERN.test(trimmed) ? trimmed : null
}
