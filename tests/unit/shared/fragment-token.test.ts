import { describe, expect, it } from 'vitest'
import { ACCOUNT_TOKEN_PATTERN, readFragmentToken } from '@/shared/lib'

/**
 * Токен из ссылки письма (ADR 0058): читается из фрагмента, формат проверяется до запроса, чтобы
 * опечатка не расходовала предел попыток с адреса.
 */

const TOKEN = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0UvW' // 43 символа base64url

describe('readFragmentToken', () => {
  it('достаёт токен из фрагмента с решёткой и без неё', () => {
    expect(readFragmentToken(`#token=${TOKEN}`)).toBe(TOKEN)
    expect(readFragmentToken(`token=${TOKEN}`)).toBe(TOKEN)
  })

  it('находит токен среди других параметров фрагмента', () => {
    expect(readFragmentToken(`#utm=mail&token=${TOKEN}&x=1`)).toBe(TOKEN)
  })

  it('убирает пробелы вокруг токена, например из-за переноса при копировании', () => {
    expect(readFragmentToken(`#token=%20${TOKEN}%0A`)).toBe(TOKEN)
  })

  it('принимает «-» и «_», которые входят в алфавит base64url', () => {
    const token = `-_${TOKEN.slice(2)}`
    expect(readFragmentToken(`#token=${token}`)).toBe(token)
  })

  it('возвращает null, если токена нет', () => {
    for (const hash of ['', '#', '#other=1', '#token', '#token=', '#Token=' + TOKEN]) {
      expect(readFragmentToken(hash), hash).toBeNull()
    }
  })

  it('отвергает токен неверной длины и неверных символов', () => {
    const wrong = [
      TOKEN.slice(1),
      TOKEN + 'a',
      TOKEN.slice(0, 42) + '=',
      TOKEN.slice(0, 42) + '+',
      TOKEN.slice(0, 42) + '/',
      TOKEN.slice(0, 42) + '.',
      TOKEN.slice(0, 42) + 'я',
      '%E0%A4%A',
    ]
    for (const token of wrong) {
      expect(readFragmentToken(`#token=${token}`), token).toBeNull()
    }
  })

  it('шаблон совпадает с серверным форматом', () => {
    expect(ACCOUNT_TOKEN_PATTERN.test(TOKEN)).toBe(true)
    expect(ACCOUNT_TOKEN_PATTERN.test(` ${TOKEN}`)).toBe(false)
    expect(ACCOUNT_TOKEN_PATTERN.test(`${TOKEN}\n`)).toBe(false)
  })
})
