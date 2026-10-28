import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TENANT_ID, mockOwner } from './fixtures/api'

/**
 * Мастер «Начало работы», шаг 1 «Компания» (US-M02-01) у нового владельца без организации.
 * Backend замокан: ответы повторяют контракт `/auth/me` и `POST /organizations`.
 */

const USER = {
  id: '01990000-0000-7000-8000-000000000f01',
  email: 'owner@example.test',
  displayName: 'Мария Владелец',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-09-01T09:00:00Z',
  deletionDueAt: null,
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}
const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Новый владелец: организации нет, право создать есть; после создания членство появляется в `/auth/me`. */
async function mockNewOwner(page: Page): Promise<{ created: () => number }> {
  await mockOwner(page)
  let created = 0
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, {
      user: USER,
      canCreateOrganization: created === 0,
      memberships:
        created === 0
          ? []
          : [{ tenantId: TENANT_ID, organizationName: 'QA Иванов', role: 'OWNER' }],
    }),
  )
  await page.route('**/api/v1/organizations', async (route) => {
    created += 1
    await new Promise((resolve) => setTimeout(resolve, 200))
    return json(route, 201, {
      id: TENANT_ID,
      name: 'QA Иванов',
      defaultTimezone: 'Europe/Moscow',
      defaultCurrency: 'RUB',
      status: 'ACTIVE',
      createdAt: '2026-10-28T09:00:00Z',
      updatedAt: '2026-10-28T09:00:00Z',
    })
  })
  return { created: () => created }
}

test.describe('шаг 1 «Компания» (US-M02-01)', () => {
  test('экран по макету: прогресс, поля, подсказки; пустое название не отправляется', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Расскажите о компании' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 1 из 4',
    )
    await expect(page.getByLabel('Название компании')).toBeVisible()
    await expect(page.getByLabel('Часовой пояс')).toBeVisible()
    await expect(page.getByLabel('Основная валюта')).toBeVisible()
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations).toEqual([])

    await page.getByRole('button', { name: 'Создать компанию' }).click()
    await expect(page.getByText('Введите название компании.')).toBeVisible()
    await expect(page.getByLabel('Название компании')).toBeFocused()
    expect(state.created()).toBe(0)
  })

  test('название из 201 символа, набранное с клавиатуры, не обрезается: «Слишком длинное название»', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    const name = page.getByLabel('Название компании')
    await name.pressSequentially('я'.repeat(201))
    await page.getByRole('button', { name: 'Создать компанию' }).click()
    await expect(page.getByText('Слишком длинное название')).toBeVisible()
    expect(state.created()).toBe(0)
  })

  test('на телефоне каждый шаг ряда читается с названием и состоянием', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockNewOwner(page)
    await page.goto('/onboarding/company')
    const steps = page.getByRole('navigation', { name: 'Шаги начала работы' }).getByRole('listitem')
    await expect(steps).toHaveCount(4)
    await expect(steps.nth(0)).toContainText('Компания')
    await expect(steps.nth(0)).toContainText('текущий шаг')
    await expect(steps.nth(3)).toContainText('Источник сообщений')
  })

  test('создание: «Создаём компанию…», одна организация при двойном нажатии, переход к шагу 2 с галочкой у шага 1', async ({
    page,
  }) => {
    const state = await mockNewOwner(page)
    await page.goto('/onboarding/company')
    await page.getByLabel('Название компании').fill('QA Иванов')
    const button = page.getByRole('button', { name: 'Создать компанию' })
    await button.dblclick()
    await expect(page.getByText('Создаём компанию…')).toBeVisible()
    await expect(page).toHaveURL(/\/onboarding\/location$/)
    expect(state.created()).toBe(1)
    // В ряду шагов шаг «Компания» выполнен.
    const steps = page.getByRole('navigation', { name: 'Шаги начала работы' })
    await expect(steps.getByRole('listitem').first()).toContainText('выполнено')
  })

  for (const width of [320, 390, 834, 1440]) {
    test(`страница не прокручивается по горизонтали (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockNewOwner(page)
      await page.goto('/onboarding/company')
      await expect(page.getByLabel('Название компании')).toBeVisible()
      await page.getByLabel('Название компании').fill('Очень'.repeat(33))
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await expect(page.getByRole('button', { name: 'Создать компанию' })).toBeInViewport()
    })
  }
})

test.describe('шаг 2 «Точка и график» (US-M02-02)', () => {
  test('экран по макету: карточка графика, пояс, подсказки, ряд шагов; ошибка границ с фокусом и «Назад»', async ({
    page,
  }) => {
    await mockOwner(page)
    await page.goto('/onboarding/location')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Когда вы отвечаете клиентам?' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(
      'График точки · Студия на Тверской',
    )
    await expect(page.getByText('Москва · UTC+3')).toBeVisible()
    await expect(page.getByText('Для копирования используется первый рабочий день.')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
      'Шаг 2 из 4',
    )
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(axe.violations).toEqual([])

    await page.locator('input[name="opens-1"]').fill('20:00')
    await page.locator('input[name="closes-1"]').fill('09:00')
    await page.getByRole('button', { name: 'Сохранить и продолжить' }).click()
    await expect(page.getByText('Время окончания должно быть позже начала.')).toBeVisible()
    await expect(page.locator('input[name="opens-1"]')).toBeFocused()
    await expect(page).toHaveURL(/\/onboarding\/location$/)

    await page.getByRole('button', { name: 'Назад' }).click()
    await expect(page).toHaveURL(/\/onboarding\/company$/)
  })
})
