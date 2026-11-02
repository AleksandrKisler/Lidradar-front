import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockOwner, TENANT_ID } from './fixtures/api'

const respond = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function step(page: Page, number: number) {
  await expect(page.getByRole('navigation', { name: 'Шаги начала работы' })).toContainText(
    `Шаг ${number} из 4`,
  )
}

async function capture(page: Page, info: TestInfo, name: string) {
  if (info.project.name !== 'chromium') return
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

test.describe('восстановление подтверждённой компании (QA-R1-02)', () => {
  for (const variant of ['consumed', 'open', 'multiple'] as const) {
    test(`confirmed201 → refresh503 → reload (${variant})`, async ({ page }) => {
      await mockOwner(page)
      const createdId = '01990000-0000-7000-8000-000000000002'
      let created = 0
      let failureDelivered = false
      let company = {
        id: createdId,
        name: '',
        defaultTimezone: 'Europe/Moscow',
        defaultCurrency: 'RUB',
        status: 'ACTIVE',
        createdAt: '2026-11-02T09:00:00Z',
        updatedAt: '2026-11-02T09:00:00Z',
      }
      const patches: { tenant: string | undefined; body: unknown }[] = []
      await page.route('**/api/v1/auth/me', (route) => {
        if (created && !failureDelivered) {
          failureDelivered = true
          return respond(
            route,
            { error: { code: 'UNAVAILABLE', message: 'temporary', traceId: 'recovery-503' } },
            503,
          )
        }
        return respond(route, {
          user: {
            id: '01990000-0000-7000-8000-000000000101',
            email: 'owner@example.test',
            displayName: 'Мария Владелец',
            status: 'ACTIVE',
            emailVerifiedAt: null,
            deletionDueAt: null,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt,
          },
          memberships: [
            ...(variant === 'multiple'
              ? [{ tenantId: TENANT_ID, organizationName: 'Прежняя компания', role: 'OWNER' }]
              : []),
            ...(created
              ? [{ tenantId: createdId, organizationName: company.name, role: 'OWNER' }]
              : []),
          ],
          canCreateOrganization: created === 0 || variant !== 'consumed',
        })
      })
      await page.route('**/api/v1/organizations', (route) => {
        created += 1
        company = { ...company, ...route.request().postDataJSON() }
        return respond(route, company, 201)
      })
      await page.route('**/api/v1/organization', (route) => {
        if (route.request().method() === 'PATCH') {
          const body = route.request().postDataJSON()
          patches.push({ tenant: route.request().headers()['x-tenant-id'], body })
          company = { ...company, ...body }
        }
        return respond(route, company)
      })
      await page.goto('/onboarding/company?new=1')
      await page.getByLabel('Название компании').fill('Создана один раз')
      await page.getByRole('button', { name: 'Создать компанию', exact: true }).click()
      await expect(page.getByText('recovery-503', { exact: true })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/onboarding/company\\?company=${createdId}$`))
      expect(created).toBe(1)
      await page.reload()
      await expect(page.getByLabel('Название компании')).toHaveValue('Создана один раз')
      await page.getByLabel('Название компании').fill('Отредактирована та же компания')
      await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click()
      await step(page, 2)
      expect(created).toBe(1)
      expect(patches).toEqual([
        { tenant: createdId, body: { name: 'Отредактирована та же компания' } },
      ])
    })
  }
})

test.describe('возврат в онбординге на существующем API', () => {
  test('несохранённое название компании остаётся при browser Back и повторном входе на шаг 1', async ({
    page,
  }) => {
    await mockOwner(page)
    const writes: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'PATCH' || request.method() === 'POST') writes.push(request.url())
    })
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Назад', exact: true }).click()
    await page.getByLabel('Название компании').fill('Черновик вывески')
    await page.goBack()
    await step(page, 2)
    await page.getByRole('button', { name: 'Назад', exact: true }).click()
    await expect(page.getByLabel('Название компании')).toHaveValue('Черновик вывески')
    expect(writes).toEqual([])
  })

  test('отправка новой услуги блокирует уход до подтверждения и очищает черновик после успеха', async ({
    page,
  }) => {
    await mockOwner(page)
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/v1/services', async (route) => {
      if (route.request().method() === 'POST') await pending
      await route.fallback()
    })
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
    await page.getByTestId('location-continue').click()
    await page.getByLabel('Название услуги', { exact: true }).fill('Без дублей')
    const submitted = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/services',
    )
    await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click()
    await submitted
    await expect(page.getByRole('button', { name: 'Назад', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled()
    await page.goBack()
    await expect(page).toHaveURL(/\/onboarding\/services$/)
    release!()
    await expect(page.getByRole('list', { name: 'Добавленные услуги' })).toContainText('Без дублей')
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
    await step(page, 4)
    await page.goBack()
    await expect(page.getByLabel('Название услуги', { exact: true })).toHaveValue('')
  })

  for (const width of [1440, 834, 390]) {
    test(`3 → 2 → 1 → 2 → 3: та же компания и черновики (${width})`, async ({ page }, info) => {
      await page.setViewportSize({
        width,
        height: width === 834 ? 1194 : width === 390 ? 844 : 1000,
      })
      await page.clock.setFixedTime(new Date('2026-11-02T09:00:00Z'))
      await mockOwner(page)
      const writes: { method: string; path: string; tenant: string | undefined; body: unknown }[] =
        []
      page.on('request', (request) => {
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method())) {
          writes.push({
            method: request.method(),
            path: new URL(request.url()).pathname,
            tenant: request.headers()['x-tenant-id'],
            body: request.postDataJSON(),
          })
        }
      })
      await page.goto('/onboarding/location')
      await step(page, 2)
      await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
      await expect(page.getByTestId('location-continue')).toBeEnabled()
      await page.getByTestId('location-continue').click()
      await step(page, 3)
      await page.getByLabel('Название услуги', { exact: true }).fill('Оклейка капота')
      await page.getByLabel('Цена от', { exact: true }).fill('18000')
      await page
        .getByLabel('Точка', { exact: true })
        .selectOption('01990000-0000-7000-8000-000000000201')
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await expect(page).toHaveURL(/\/onboarding\/location$/)
      await step(page, 2)
      await page.locator('input[name="opens-1"]').fill('08:15')
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await step(page, 1)
      await expect(page.getByLabel('Название компании')).toHaveValue('Студия «Блик»')
      await page.getByLabel('Название компании').fill('Студия «Новый Блик»')
      await capture(page, info, `company-${width}`)
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([])
      await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).dblclick()
      await step(page, 2)
      await expect(page.locator('input[name="opens-1"]')).toHaveValue('08:15')
      expect(writes.filter((item) => item.method === 'PUT')).toHaveLength(1)
      await capture(page, info, `location-${width}`)
      await page.getByTestId('location-continue').click()
      await step(page, 3)
      await expect(page.getByLabel('Название услуги', { exact: true })).toHaveValue(
        'Оклейка капота',
      )
      await expect(page.getByLabel('Цена от', { exact: true })).toHaveValue('18000')
      await expect(page.getByLabel('Точка', { exact: true })).toHaveValue(
        '01990000-0000-7000-8000-000000000201',
      )
      await capture(page, info, `services-${width}`)
      await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click()
      await expect(page.getByRole('list', { name: 'Добавленные услуги' })).toContainText(
        'Оклейка капота',
      )
      await expect(page.getByLabel('Название услуги', { exact: true })).toHaveValue('')
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
      await step(page, 4)
      await page.goBack()
      await step(page, 3)
      await expect(page.getByRole('list', { name: 'Добавленные услуги' })).toContainText(
        'Оклейка капота',
      )
      await page.goBack()
      await step(page, 2)
      await page.reload()
      await expect(page.locator('input[name="opens-1"]')).toHaveValue('08:15')
      await page.getByRole('button', { name: 'Назад', exact: true }).click()
      await expect(page.getByLabel('Название компании')).toHaveValue('Студия «Новый Блик»')
      expect(writes.filter((item) => item.path === '/api/v1/organizations')).toEqual([])
      expect(
        writes.filter((item) => item.method === 'PATCH' && item.path === '/api/v1/organization'),
      ).toEqual([
        {
          method: 'PATCH',
          path: '/api/v1/organization',
          tenant: TENANT_ID,
          body: { name: 'Студия «Новый Блик»' },
        },
      ])
      expect(
        writes.filter((item) => item.method === 'POST' && item.path === '/api/v1/services'),
      ).toHaveLength(1)
      expect(writes.some((item) => item.method === 'DELETE')).toBe(false)
    })
  }

  test('после создания компании browser Back проходит 3 → 2 → 1 без повторного создания', async ({
    page,
  }) => {
    await mockOwner(page)
    let creations = 0
    let company = {
      id: TENANT_ID,
      name: '',
      defaultTimezone: 'Europe/Moscow',
      defaultCurrency: 'RUB',
      status: 'ACTIVE',
      createdAt: '2026-11-02T09:00:00Z',
      updatedAt: '2026-11-02T09:00:00Z',
    }
    await page.route('**/api/v1/auth/me', (route) =>
      respond(route, {
        user: {
          id: '01990000-0000-7000-8000-000000000101',
          email: 'owner@example.test',
          displayName: 'Мария Владелец',
          status: 'ACTIVE',
          emailVerifiedAt: null,
          deletionDueAt: null,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
        memberships: creations
          ? [{ tenantId: TENANT_ID, organizationName: company.name, role: 'OWNER' }]
          : [],
        canCreateOrganization: creations === 0,
      }),
    )
    await page.route('**/api/v1/organizations', (route) => {
      creations += 1
      company = { ...company, ...route.request().postDataJSON() }
      return respond(route, company, 201)
    })
    await page.route('**/api/v1/organization', (route) => respond(route, company))
    await page.goto('/onboarding/company')
    await page.getByLabel('Название компании').fill('Одна компания')
    await page.getByRole('button', { name: 'Создать компанию', exact: true }).dblclick()
    await step(page, 2)
    await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
    await page.getByTestId('location-continue').click()
    await step(page, 3)
    await page.goBack()
    await step(page, 2)
    await page.goBack()
    await step(page, 1)
    await expect(page.getByLabel('Название компании')).toHaveValue('Одна компания')
    await expect(
      page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }),
    ).toBeVisible()
    expect(creations).toBe(1)
  })

  test('поздний ответ сохранения компании после browser Back не возвращает пользователя вперёд', async ({
    page,
  }) => {
    await mockOwner(page)
    let release: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/v1/organization', async (route) => {
      const body = {
        id: TENANT_ID,
        name: 'Студия «Блик»',
        defaultTimezone: 'Europe/Moscow',
        defaultCurrency: 'RUB',
        status: 'ACTIVE',
        createdAt: '2026-11-02T09:00:00Z',
        updatedAt: '2026-11-02T09:00:00Z',
      }
      if (route.request().method() !== 'PATCH') return respond(route, body)
      await pending
      return respond(route, { ...body, ...route.request().postDataJSON() })
    })
    await page.goto('/onboarding/location')
    await page.getByRole('button', { name: 'Назад', exact: true }).click()
    await page.getByLabel('Название компании').fill('Сохранённое имя')
    const request = page.waitForRequest(
      (request) =>
        request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/v1/organization',
    )
    await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click()
    await request
    await page.goBack()
    await step(page, 2)
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname === '/api/v1/organization',
    )
    release!()
    await refreshed
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await step(page, 2)
    await expect(page).toHaveURL(/\/onboarding\/location$/)
  })

  test('создание ещё одной компании начинается явной ссылкой из рабочих пространств', async ({
    page,
  }) => {
    await mockOwner(page)
    await page.route('**/api/v1/auth/me', (route) =>
      respond(route, {
        user: {
          id: '01990000-0000-7000-8000-000000000101',
          email: 'owner@example.test',
          displayName: 'Мария Владелец',
          status: 'ACTIVE',
          createdAt: '2026-11-02T09:00:00Z',
          updatedAt: '2026-11-02T09:00:00Z',
        },
        memberships: [{ tenantId: TENANT_ID, organizationName: 'Первая компания', role: 'OWNER' }],
        canCreateOrganization: true,
      }),
    )
    await page.goto('/workspaces')
    await page.getByRole('link', { name: 'Создать организацию', exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/company\?new=1$/)
    await expect(page.getByLabel('Название компании')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Создать компанию', exact: true })).toBeVisible()
  })
})
