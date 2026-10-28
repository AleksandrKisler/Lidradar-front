import { expect, test, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TENANT_ID, mockGuest, mockOwner } from './fixtures/api'

/**
 * Несколько организаций и пользователь без права создать организацию
 * (US-M01-08, US-M02-07). Backend замокан: ответы повторяют контракт `/auth/me`.
 */

const SECOND_TENANT_ID = '01990000-0000-7000-8000-000000000002'
const USER = {
  id: '01990000-0000-7000-8000-000000000101',
  email: 'owner@example.test',
  displayName: 'Мария Владелец',
  status: 'ACTIVE',
  emailVerifiedAt: '2026-09-01T09:00:00Z',
  deletionDueAt: null,
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z',
}
const FIRST = { tenantId: TENANT_ID, organizationName: 'Студия «Блик»', role: 'OWNER' }
const SECOND = { tenantId: SECOND_TENANT_ID, organizationName: 'Кофейня «Зерно»', role: 'MANAGER' }

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Владелец одной организации и менеджер второй; данные Radar различаются по заголовку организации. */
async function mockTwoOrganizations(page: Page, memberships = [FIRST, SECOND]): Promise<string[]> {
  await mockOwner(page)
  const tenantsSeen: string[] = []
  await page.route('**/api/v1/auth/me', (route) =>
    json(route, 200, { user: USER, memberships, canCreateOrganization: false }),
  )
  await page.route('**/api/v1/radar**', (route) => {
    const tenant = route.request().headers()['x-tenant-id'] ?? ''
    tenantsSeen.push(tenant)
    const first = tenant === TENANT_ID
    return json(route, 200, {
      openRisks: first ? 2 : 7,
      criticalRisks: first ? 1 : 3,
      potentialRevenue: first ? '47000.00' : '91000.00',
      confirmedRecoveredRevenue: '0.00',
    })
  })
  return tenantsSeen
}

async function openMenuIfNarrow(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('button', { name: 'Меню' }).click()
  }
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(violations).toEqual([])
}

test.describe('несколько организаций (US-M01-08)', () => {
  test('вход без запомненного выбора открывает список с ролями; выбор открывает Radar этой организации', async ({
    page,
  }) => {
    const tenants = await mockTwoOrganizations(page)
    await page.goto('/radar')
    await expect(page).toHaveURL(/\/workspaces$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Выберите рабочее пространство' }),
    ).toBeVisible()
    const list = page.getByRole('list', { name: 'Рабочие пространства' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list.getByRole('listitem').nth(0)).toContainText('Студия «Блик»')
    await expect(list.getByRole('listitem').nth(0)).toContainText('Владелец')
    await expect(list.getByRole('listitem').nth(1)).toContainText('Кофейня «Зерно»')
    await expect(list.getByRole('listitem').nth(1)).toContainText('Менеджер')
    await expectNoAxeViolations(page)

    await list.getByRole('button', { name: /Студия «Блик»/ }).click()
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()
    expect(tenants.length).toBeGreaterThan(0)
    expect(new Set(tenants)).toEqual(new Set([TENANT_ID]))
  })

  test('смена организации в боковом меню не оставляет данные прежней; выбор запоминается после перезагрузки', async ({
    page,
  }) => {
    const tenants = await mockTwoOrganizations(page)
    await page.goto('/workspaces')
    await page.getByRole('button', { name: /Студия «Блик»/ }).click()
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByText('47 000').first()).toBeVisible()

    await openMenuIfNarrow(page)
    await page
      .getByRole('combobox', { name: 'Рабочее пространство' })
      .selectOption(SECOND_TENANT_ID)
    // Данные второй организации заменили данные первой, а не наложились на них.
    await expect(page.getByText('91 000').first()).toBeVisible()
    await expect(page.getByText('47 000')).toHaveCount(0)
    expect(tenants.at(-1)).toBe(SECOND_TENANT_ID)

    // Менеджеру второй организации не видны разделы владельца.
    await openMenuIfNarrow(page)
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Интеграции' })).toHaveCount(0)

    // Выход и новый вход в том же окне: сразу последняя организация, без экрана выбора.
    await page.reload()
    await expect(page).toHaveURL(/\/radar$/)
    await expect(page.getByText('91 000').first()).toBeVisible()
  })

  test('Radar не открылся после выбора: список остаётся, «Повторить» перезагружает страницу', async ({
    page,
  }) => {
    await mockTwoOrganizations(page)
    let blocked = true
    await page.route('**/assets/radar-*.js', (route) =>
      blocked
        ? route.fulfill({ status: 503, headers: { 'Cache-Control': 'no-store' } })
        : route.continue(),
    )
    await page.goto('/workspaces')
    const list = page.getByRole('list', { name: 'Рабочие пространства' })
    await list.getByRole('button', { name: /Студия «Блик»/ }).click()
    await expect(page.getByRole('alert')).toContainText('Не удалось загрузить пространства')
    // Заблокированная кнопка выбора потеряла фокус: он на «Повторить».
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeFocused()
    await expect(page).toHaveURL(/\/workspaces$/)
    await expect(list.getByRole('listitem')).toHaveCount(2)
    blocked = false
    // Метка живёт только в старом документе: её исчезновение — признак полной перезагрузки.
    await page.evaluate(() => ((window as unknown as { reloadMark: number }).reloadMark = 1))
    await page.getByRole('button', { name: 'Повторить' }).click()
    await page.waitForFunction(
      () => (window as unknown as { reloadMark?: number }).reloadMark === undefined,
    )
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(page.getByRole('alert')).toHaveCount(0)
    // Выбор сохранён: после перезагрузки пространство остаётся текущим.
    await expect(list.getByRole('listitem').nth(0)).toContainText('Текущее')
  })

  test('длинное название организации переносится: страница не прокручивается по горизонтали', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    const long = { ...FIRST, organizationName: 'Очень'.repeat(25) + ' Длинное Название Студии' }
    await mockTwoOrganizations(page, [long, SECOND])
    await page.goto('/workspaces')
    await expect(page.getByRole('button', { name: /ОченьОчень/ })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('приглашение (US-M01-08, US-M02-07)', () => {
  test('неизвестный код объясняется под полем и не стирает введённое', async ({ page }) => {
    await mockTwoOrganizations(page)
    await page.goto('/invitations/accept')
    const code = page.getByLabel('Код приглашения')
    const value = 'e2e-unknown-invitation-code-'.padEnd(43, 'z')
    await code.fill(value)
    await page.getByRole('button', { name: 'Присоединиться' }).click()
    await expect(
      page.getByText(
        'Код недействителен или срок его действия истёк. Попросите владельца прислать новый.',
      ),
    ).toBeVisible()
    await expect(code).toHaveAttribute('aria-invalid', 'true')
    await expect(code).toHaveValue(value)
    await expectNoAxeViolations(page)
    await page.getByRole('link', { name: 'Вернуться к рабочим пространствам' }).click()
    await expect(page).toHaveURL(/\/workspaces$/)
  })

  test('без членств и без права создавать организацию: подсказка вместо формы, раздел компании недоступен', async ({
    page,
  }) => {
    await mockOwner(page, { role: 'MANAGER', joinByInvitation: true })
    await page.goto('/onboarding/company')
    await expect(page.getByText('Организацию создают по приглашению платформы')).toBeVisible()
    await expect(page.getByLabel('Название организации')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Создать/ })).toHaveCount(0)
  })

  test('менеджер организации: «Раздел недоступен» с возвратом в Radar', async ({ page }) => {
    await mockOwner(page, { role: 'MANAGER' })
    await page.goto('/settings/company')
    await expect(page.getByText('Раздел недоступен')).toBeVisible()
    await page.getByRole('button', { name: 'Вернуться в Radar' }).click()
    await expect(page).toHaveURL(/\/radar$/)
  })

  test('гость не видит список: уходит на вход', async ({ page }) => {
    await mockGuest(page)
    await page.goto('/workspaces')
    await expect(page).toHaveURL(/\/login\?redirect=\/workspaces$/)
  })
})
