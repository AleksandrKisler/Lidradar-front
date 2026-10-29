import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { InvitationCodeForm, type InvitationCodeStatus } from '@/features/auth-session'

/**
 * Шаг кода B2 (US-M01-01 AC-B02, AC-B03, AC-B06, AC-B09; AC-G10): поле со встроенным действием,
 * тексты состояний, доступность. Геометрия задаётся токенами: `h-input` = 46 px, рамка `border`
 * 1 px, область нажатия `size-11` = 44 px, видимая кнопка `size-9` = 36 px, пиктограмма `size-5` =
 * 20 px; фактические пиксели измеряются в браузере (E2E и visual capture).
 */

const CODE = 'Syn7hetic-Code_aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
let wrapper: VueWrapper | null = null

function mountForm(
  props: {
    value?: string
    status?: InvitationCodeStatus
    retrySeconds?: number
    loading?: boolean
    autofocus?: boolean
  } = {},
) {
  wrapper = mount(InvitationCodeForm, { props, attachTo: document.body })
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const input = (form: VueWrapper) => form.get('input[name="invite-code"]')
const action = (form: VueWrapper) => form.get('button[aria-label="Проверить код"]')
const message = (form: VueWrapper) => form.get(`#${input(form).attributes('aria-describedby')}`)

describe('исходное состояние (AC-B02)', () => {
  it('подпись, placeholder, две подсказки и встроенное действие; отдельной кнопки нет', () => {
    const form = mountForm()
    expect(form.get('label').text()).toBe('Код приглашения')
    expect(form.get('label').attributes('for')).toBe(input(form).attributes('id'))
    expect(input(form).attributes('placeholder')).toBe('Вставьте код приглашения')
    expect(
      message(form)
        .findAll('p')
        .map((line) => line.text()),
    ).toEqual([
      '43 символа. Скопируйте и вставьте код целиком.',
      'Код проверится автоматически после ввода.',
    ])
    expect(form.findAll('button')).toHaveLength(1)
    expect(action(form).attributes('type')).toBe('submit')
    expect(action(form).attributes('aria-describedby')).toBe(
      input(form).attributes('aria-describedby'),
    )
  })

  it('геометрия: поле 46 с одной рамкой и местом под кнопку, 44/36/20 по центру', () => {
    const form = mountForm()
    const field = input(form).classes()
    expect(field).toEqual(expect.arrayContaining(['h-input', 'border', 'pr-16']))
    expect(action(form).classes()).toEqual(
      expect.arrayContaining([
        'absolute',
        'top-px',
        'right-px',
        'size-11',
        'items-center',
        'justify-center',
      ]),
    )
    const face = form.get('[data-testid="invitation-check-face"]')
    expect(face.classes()).toEqual(
      expect.arrayContaining(['size-9', 'bg-brand', 'items-center', 'justify-center']),
    )
    // У обёртки и кнопки своей рамки нет: граница одна — у поля.
    expect(face.classes().some((name) => name.startsWith('border'))).toBe(false)
    expect(
      action(form)
        .classes()
        .some((name) => name.startsWith('border')),
    ).toBe(false)
    expect(form.get('[data-testid="invitation-check-icon"]').classes()).toContain('size-5')
  })
})

describe('тексты и вид состояний B2', () => {
  it.each<[InvitationCodeStatus, string[], boolean]>([
    ['empty', ['Для регистрации нужен код приглашения'], true],
    ['format', ['Код состоит из 43 символов: латиница, цифры, «-» и «_»'], true],
    ['invalid', ['Код приглашения не подошёл'], true],
    ['service', ['Не удалось проверить код. Попробуйте ещё раз.'], false],
    ['checking', ['Проверяем код приглашения…', 'Это займёт несколько секунд.'], false],
  ])('%s', (status, lines, invalid) => {
    const form = mountForm({ value: CODE, status })
    expect(
      message(form)
        .findAll('p')
        .map((line) => line.text()),
    ).toEqual(lines)
    expect(input(form).attributes('aria-invalid')).toBe(invalid ? 'true' : undefined)
    // Код сохранён в поле во всех состояниях.
    expect((input(form).element as HTMLInputElement).value).toBe(CODE)
  })

  it('403: красная кнопка с «!»; формат и сбой — синяя стрелка', () => {
    const rejected = mountForm({ value: CODE, status: 'invalid' })
    const face = rejected.get('[data-testid="invitation-check-face"]')
    expect(face.classes()).toContain('bg-danger')
    expect(face.find('path').attributes('d')).toContain('M432-820')
    rejected.unmount()
    for (const status of ['format', 'service', 'idle'] as const) {
      const form = mountForm({ value: CODE, status })
      expect(form.get('[data-testid="invitation-check-face"]').classes()).toContain('bg-brand')
      expect(form.get('[data-testid="invitation-check-face"] path').attributes('d')).toContain(
        'M647-440',
      )
      form.unmount()
    }
    wrapper = null
  })

  it('проверка: поле и действие недоступны, но фокус сохраняется; индикатор вместо стрелки', async () => {
    const form = mountForm({ value: CODE })
    ;(input(form).element as HTMLInputElement).focus()
    await form.setProps({ status: 'checking' })
    expect(input(form).attributes('readonly')).toBeDefined()
    expect(input(form).attributes('aria-disabled')).toBe('true')
    expect(action(form).attributes('aria-busy')).toBe('true')
    expect(action(form).attributes('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(input(form).element)
    expect(form.get('[data-testid="invitation-check-icon"]').classes()).toContain('size-5')
    const spinner = form.get('[data-testid="invitation-check-spinner"]')
    expect(spinner.classes()).toEqual(expect.arrayContaining(['animate-spin', 'size-5']))
    await form.get('form').trigger('submit')
    expect(form.emitted('check')).toBeUndefined()
    // Результат объявляется без перемещения фокуса.
    await form.setProps({ status: 'invalid' })
    expect(form.get('[role="status"]').text()).toBe('Код приглашения не подошёл')
    expect(document.activeElement).toBe(input(form).element)
  })

  it('429: отсчёт в тексте, действие приглушено и недоступно; объявление один раз', async () => {
    const form = mountForm({ value: CODE, status: 'rate-limited', retrySeconds: 30 })
    expect(message(form).text()).toBe('Слишком много проверок. Повторите через 30 с.')
    expect(action(form).attributes('aria-disabled')).toBe('true')
    expect(form.get('[data-testid="invitation-check-face"]').classes()).toContain('bg-line')
    await form.get('form').trigger('submit')
    expect(form.emitted('check')).toBeUndefined()
    await form.setProps({ retrySeconds: 29 })
    expect(message(form).text()).toBe('Слишком много проверок. Повторите через 29 с.')
  })

  it('плейсхолдер загрузки: «Загружаем форму…», без поля и действия', () => {
    const form = mountForm({ loading: true })
    expect(form.text()).toContain('Код приглашения')
    expect(form.text()).toContain('Загружаем форму…')
    expect(form.find('input').exists()).toBe(false)
    expect(form.find('button').exists()).toBe(false)
    expect(form.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
  })
})

describe('ввод и действия (AC-B04, AC-B05)', () => {
  it('ввод, IME и завершение набора передаются модели с признаком composition', async () => {
    const form = mountForm()
    const field = input(form)
    ;(field.element as HTMLInputElement).value = 'a'
    await field.trigger('input')
    await field.trigger('compositionstart')
    ;(field.element as HTMLInputElement).value = 'ab'
    await field.trigger('input')
    await field.trigger('compositionend')
    const events = form.emitted('code-input') as Array<[string, boolean]>
    expect(events[0]).toEqual(['a', false])
    // Пока идёт набор, каждое событие помечено: модель его не проверяет.
    const during = events.slice(1, -1)
    expect(during.length).toBeGreaterThan(0)
    expect(during.every(([, composing]) => composing)).toBe(true)
    // Завершение набора — обычный ввод.
    expect(events.at(-1)).toEqual(['ab', false])
  })

  it('Enter в поле и стрелка — одна и та же команда', async () => {
    const form = mountForm({ value: CODE })
    await form.get('form').trigger('submit')
    await action(form).trigger('click')
    expect(form.emitted('check')!.length).toBeGreaterThanOrEqual(1)
    expect(form.emitted('code-input')).toBeUndefined()
  })

  it('шаг открыт переходом: фокус в поле кода', () => {
    const form = mountForm({ autofocus: true })
    expect(document.activeElement).toBe(input(form).element)
  })
})
