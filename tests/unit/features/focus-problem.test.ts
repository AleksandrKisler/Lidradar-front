import { afterEach, describe, expect, it } from 'vitest'
import { focusFirstProblem } from '@/features/auth-session/lib/focus-problem'

function formWith(html: string): HTMLFormElement {
  document.body.innerHTML = `<form>${html}</form>`
  return document.querySelector('form')!
}

describe('focusFirstProblem', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('фокус на первом поле с ошибкой, а не на первом поле формы', async () => {
    const form = formWith(
      '<input name="a"><input name="b" aria-invalid="true"><input name="c" aria-invalid="true">',
    )
    await focusFirstProblem(form)
    expect((document.activeElement as HTMLInputElement).name).toBe('b')
  })

  it('без поля с ошибкой — на запасном поле, по умолчанию первом доступном', async () => {
    const form = formWith('<input name="a" disabled><input name="b"><input name="c">')
    await focusFirstProblem(form)
    expect((document.activeElement as HTMLInputElement).name).toBe('b')
    await focusFirstProblem(form, 'input[name="c"]')
    expect((document.activeElement as HTMLInputElement).name).toBe('c')
  })

  it('без формы (каркас загрузки) ничего не делает и не падает', async () => {
    await expect(focusFirstProblem(null)).resolves.toBeUndefined()
  })
})
