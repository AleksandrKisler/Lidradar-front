import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '@/shared/api'
import { RegisterForm, type RegistrationSubmitStatus } from '@/features/auth-session'

/**
 * Общая форма данных A/B3 и отключённая форма C (US-M01-01 AC-G02…G05, AC-C01/C03; US-M01-02).
 * Форма только проверяет формат и передаёт значения: поля кода и собственного запроса режима нет.
 */

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { render: () => null } },
    { path: '/login', name: 'login', component: { render: () => null } },
    { path: '/forgot-password', name: 'forgot-password', component: { render: () => null } },
  ],
})

type Props = {
  variant?: 'open' | 'invite' | 'closed'
  loading?: boolean
  draft?: { displayName: string; email: string }
  status?: RegistrationSubmitStatus
  error?: unknown
  retrySeconds?: number
  autofocus?: boolean
}

let wrapper: VueWrapper | null = null

function mountForm(props: Props = {}) {
  wrapper = mount(RegisterForm, {
    props: { error: null, ...props },
    attachTo: document.body,
    global: { plugins: [router] },
  })
  return wrapper
}

async function fill(
  form: VueWrapper,
  values: { name?: string; email?: string; password?: string },
): Promise<void> {
  if (values.name !== undefined) await form.get('input[name="name"]').setValue(values.name)
  if (values.email !== undefined) await form.get('input[name="email"]').setValue(values.email)
  if (values.password !== undefined) {
    await form.get('input[name="new-password"]').setValue(values.password)
  }
}

async function submit(form: VueWrapper): Promise<void> {
  await form.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve, 10))
  await flushPromises()
}

const valid = { name: 'Мария', email: 'maria@example.test', password: 'synthetic-pass-1' }

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('единая форма A/B3 (AC-G02)', () => {
  it.each(['open', 'invite'] as const)('%s: имя, почта и пароль; поля кода нет', (variant) => {
    const form = mountForm({ variant })
    const names = form.findAll('input').map((input) => input.attributes('name'))
    expect(names).toEqual(['name', 'email', 'new-password'])
    expect(form.text()).not.toContain('Код приглашения')
    expect(form.get('input[name="name"]').attributes('placeholder')).toBe('Введите имя')
    expect(form.get('input[name="email"]').attributes('placeholder')).toBe('name@example.com')
    expect(form.get('input[name="new-password"]').attributes('placeholder')).toBe(
      'Придумайте пароль',
    )
    expect(form.text()).toContain('Не меньше 12 символов.')
  })

  it('отправляет только данные аккаунта; имя и почта берутся из памяти страницы, пароль — нет', async () => {
    const form = mountForm({
      variant: 'invite',
      draft: { displayName: 'Мария', email: 'maria@example.test' },
    })
    expect((form.get('input[name="name"]').element as HTMLInputElement).value).toBe('Мария')
    expect((form.get('input[name="new-password"]').element as HTMLInputElement).value).toBe('')
    await fill(form, { password: valid.password })
    await submit(form)
    expect(form.emitted('submit')).toEqual([
      [{ displayName: 'Мария', email: valid.email, password: valid.password }],
    ])
  })

  it('правка имени и почты передаётся в память страницы и снимает устаревший отказ', async () => {
    const form = mountForm({ variant: 'open' })
    await fill(form, { name: 'Анна', email: 'anna@example.test' })
    expect(form.emitted('update:draft')!.at(-1)).toEqual([
      { displayName: 'Анна', email: 'anna@example.test' },
    ])
    expect(form.emitted('edit')!.length).toBeGreaterThan(0)
  })
})

describe('проверка до запроса (AC-G03)', () => {
  it('пустое имя, 201 символ, пароль 11/1025, неверная почта — ошибки у полей, отправки нет', async () => {
    const form = mountForm({ variant: 'open' })
    await submit(form)
    expect(form.text()).toContain('Введите имя')
    expect(form.get('input[name="name"]').attributes('aria-invalid')).toBe('true')
    // Фокус — на первом поле с ошибкой.
    expect(document.activeElement).toBe(form.get('input[name="name"]').element)

    await fill(form, { ...valid, password: '12345678901' })
    await submit(form)
    expect(form.text()).toContain('Не меньше 12 символов')
    expect(form.get('input[name="new-password"]').attributes('aria-invalid')).toBe('true')

    await fill(form, { ...valid, password: 'p'.repeat(1025) })
    await submit(form)
    expect(form.text()).toContain('Слишком длинный пароль')

    await fill(form, { ...valid, email: 'maria.example.test' })
    await submit(form)
    expect(form.text()).toContain('Введите корректный адрес электронной почты.')
    const email = form.get('input[name="email"]')
    expect(email.attributes('aria-invalid')).toBe('true')
    expect(email.attributes('aria-describedby')).toMatch(/-error$/)
    expect(document.activeElement).toBe(email.element)

    await fill(form, { ...valid, name: 'я'.repeat(201) })
    await submit(form)
    expect(form.get('input[name="name"]').attributes('aria-invalid')).toBe('true')
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('граничные значения проходят: имя 200, пароль 12 и 1024', async () => {
    const form = mountForm({ variant: 'open' })
    await fill(form, { ...valid, name: 'я'.repeat(200), password: 'p'.repeat(12) })
    await submit(form)
    await fill(form, { password: 'p'.repeat(1024) })
    await submit(form)
    expect(form.emitted('submit')).toHaveLength(2)
    expect(form.get('input[name="name"]').attributes('maxlength')).toBe('200')
  })
})

describe('закрытая форма C (AC-C01, AC-C03, AC-C04)', () => {
  it('поля, показ пароля и кнопка недоступны; клик и Enter ничего не отправляют', async () => {
    const form = mountForm({
      variant: 'closed',
      draft: { displayName: 'Мария', email: 'm@x.test' },
    })
    for (const name of ['name', 'email', 'new-password']) {
      const input = form.get(`input[name="${name}"]`)
      expect(input.attributes('disabled')).toBeDefined()
      expect((input.element as HTMLInputElement).value).toBe('')
    }
    expect(form.get('button[aria-label="Показать пароль"]').attributes('disabled')).toBeDefined()
    const button = form.get('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Создать аккаунт')
    await button.trigger('click')
    await form.get('input[name="email"]').trigger('keydown', { key: 'Enter' })
    await submit(form)
    expect(form.emitted('submit')).toBeUndefined()
    expect(form.find('[data-testid="register-feedback"]').exists()).toBe(false)
    // Правовые ссылки остаются активными и открываются в новой вкладке.
    const legal = form.get('[data-testid="register-legal"]').findAll('a')
    expect(legal.map((link) => link.attributes('target'))).toEqual(['_blank', '_blank'])
  })
})

describe('отправка и общий отказ (AC-G04, AC-G05, US-M01-02)', () => {
  it('отправка: «Создаём аккаунт…», поля и кнопка заблокированы, имя кнопки сохранено', async () => {
    const form = mountForm({ variant: 'invite', status: 'submitting' })
    const button = form.get('button[type="submit"]')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toContain('Создаём аккаунт…')
    expect(button.get('.sr-only').text()).toBe('Создать аккаунт')
    for (const name of ['name', 'email', 'new-password']) {
      expect(form.get(`input[name="${name}"]`).attributes('disabled')).toBeDefined()
    }
    await submit(form)
    expect(form.emitted('submit')).toBeUndefined()
  })

  it.each([
    [
      'REGISTRATION_FAILED',
      new ApiError({ httpStatus: 400, code: 'REGISTRATION_FAILED', traceId: 'trace-x' }),
    ],
    [
      'legacy 409',
      new ApiError({ httpStatus: 409, code: 'EMAIL_ALREADY_REGISTERED', traceId: 'trace-x' }),
    ],
  ])(
    '%s: один нейтральный блок над формой, почта не отмечена, данные на месте, фокус на блоке',
    async (_name, error) => {
      const form = mountForm({ variant: 'invite' })
      await fill(form, { ...valid, email: 'busy@example.test' })
      await form.setProps({ status: 'rejected', error })
      await flushPromises()
      const feedback = form.get('[data-testid="register-feedback"]')
      expect(feedback.text()).toContain('Не удалось создать аккаунт')
      expect(feedback.text()).toContain('Проверьте данные или попробуйте позже.')
      expect(feedback.text()).not.toMatch(/зарегистрирован|используется|trace-x|EMAIL|REGISTRATION/)
      expect(form.findAll('[role="alert"]')).toHaveLength(1)
      // Блок стоит до формы, а не у поля почты.
      const order = feedback.element.compareDocumentPosition(form.get('form').element)
      expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(form.get('input[name="email"]').attributes('aria-invalid')).toBeUndefined()
      expect(document.activeElement).toBe(feedback.element)
      expect((form.get('input[name="email"]').element as HTMLInputElement).value).toBe(
        'busy@example.test',
      )
      expect((form.get('input[name="new-password"]').element as HTMLInputElement).value).toBe(
        valid.password,
      )
      expect(form.get('input[name="new-password"]').attributes('type')).toBe('password')
      // Поля доступны для исправления и явного повтора.
      expect(form.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
      await fill(form, { email: 'free@example.test' })
      await submit(form)
      expect(form.emitted('submit')!.at(-1)).toEqual([
        { displayName: valid.name, email: 'free@example.test', password: valid.password },
      ])
    },
  )

  it('неизвестный исход: текст и переходы на вход и восстановление, отправка заблокирована', async () => {
    const form = mountForm({ variant: 'invite', status: 'outcome-unknown' })
    await flushPromises()
    const feedback = form.get('[data-testid="register-feedback"]')
    expect(feedback.text()).toContain(
      'Не удалось получить результат регистрации. Попробуйте войти или восстановить пароль.',
    )
    expect(feedback.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '/login',
      '/forgot-password',
    ])
    expect(form.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('аккаунт создан, сессия не загрузилась: повтор только загрузки', async () => {
    const form = mountForm({ variant: 'open', status: 'session-error' })
    await flushPromises()
    expect(form.get('[data-testid="register-feedback"]').text()).toContain('Аккаунт создан')
    expect(form.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.get('[data-testid="register-feedback"] button').trigger('click')
    expect(form.emitted('retry-session')).toHaveLength(1)
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('429 регистрации: кнопка с отсчётом, объявление один раз', async () => {
    const form = mountForm({
      variant: 'open',
      status: 'failed',
      error: new ApiError({ httpStatus: 429, code: 'RATE_LIMITED' }),
      retrySeconds: 30,
    })
    await flushPromises()
    const button = form.get('button[type="submit"]')
    expect(button.text()).toBe('Создать аккаунт через 30 с')
    expect(button.attributes('disabled')).toBeDefined()
    expect(form.text()).toContain('Регистрация временно недоступна')
  })

  it('первичная загрузка: подписи на месте, полей, кода и действий нет', () => {
    const form = mountForm({ loading: true })
    const text = form.text()
    for (const label of ['Имя', 'Электронная почта', 'Пароль', 'Создать аккаунт']) {
      expect(text).toContain(label)
    }
    expect(text).not.toContain('Код приглашения')
    expect(form.find('input').exists()).toBe(false)
    expect(form.find('button').exists()).toBe(false)
    expect(form.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
  })

  it('открыта успешной проверкой кода: фокус на первом поле', () => {
    const form = mountForm({ variant: 'invite', autofocus: true })
    expect(document.activeElement).toBe(form.get('input[name="name"]').element)
  })
})
