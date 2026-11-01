import { expect, test, type Locator, type Page } from '@playwright/test'
import { TENANT_ID } from './fixtures/api'
import { FIRST_LOCATION, refreshSettings } from './fixtures/settings-company'
import {
  CREATED_SERVICE_ID,
  SERVICE_IDS,
  settingsServicesFixture,
  type SettingsServicesFixture,
} from './fixtures/settings-services'

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
let fixture: SettingsServicesFixture
test.afterEach(() => fixture?.dispose())
const visible = (locator: Locator) => locator.filter({ visible: true })
const add = (page: Page) => page.getByRole('button', { name: 'Добавить услугу', exact: true })
const edit = (page: Page, name: string) =>
  visible(page.getByRole('button', { name: `Изменить услугу «${name}»`, exact: true }))
const toggle = (page: Page, name: string) =>
  visible(page.getByRole('switch', { name: `Активность услуги «${name}»`, exact: true }))
const formDialog = (page: Page) => page.getByRole('dialog')
const filter = (page: Page, name: 'Все' | 'Активные' | 'Отключённые', count?: number) =>
  page.getByRole('button', {
    name: new RegExp(`^${name}${name === 'Все' ? '(?: услуги)?' : ''}\\D*${count ?? '\\d+'}$`),
  })
async function open(page: Page) {
  await page.goto('/settings/services')
  await expect(page.getByRole('heading', { name: 'Услуги и цены', exact: true })).toBeVisible()
  await expect(toggle(page, fixture.services[0]!.name)).toBeVisible()
}
async function fill(page: Page, name = 'Мойка QA') {
  const dialog = formDialog(page)
  await dialog.locator('input[name=serviceName]').fill(name)
  await dialog.locator('select[name=serviceLocation]').selectOption(FIRST_LOCATION)
  await dialog.locator('input[name=priceFrom]').fill('1490,50')
  await dialog.locator('input[name=priceTo]').fill('')
}
async function submitTwice(page: Page) {
  await formDialog(page)
    .locator('form')
    .evaluate((form) => {
      ;(form as HTMLFormElement).requestSubmit()
      ;(form as HTMLFormElement).requestSubmit()
    })
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
async function inViewport(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const rect = await locator.boundingBox()
  expect(rect).not.toBeNull()
  expect(rect!.y).toBeGreaterThanOrEqual(0)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
  expect(rect!.x).toBeGreaterThanOrEqual(0)
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
}

test('M03-01: six price meanings, cents, counters and filters; reads use selected tenant', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  const prices = [
    /31\s000\s*₽/,
    /8\s000\s*[–—−-]\s*12\s000\s*₽/,
    /от\s*1\s500\s*₽/,
    /до\s*3\s500\s*₽/,
    /Не указана/,
    /1\s490[,.]50\s*₽/,
  ]
  for (const [index, item] of fixture.services.entries()) {
    const row = visible(
      page.locator('tr,article').filter({
        has: page.getByRole('switch', { name: `Активность услуги «${item.name}»`, exact: true }),
      }),
    )
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(prices[index]!)
  }
  await expect(filter(page, 'Все', 6)).toBeVisible()
  await expect(filter(page, 'Активные', 5)).toBeVisible()
  await expect(filter(page, 'Отключённые', 1)).toBeVisible()
  await filter(page, 'Отключённые', 1).click()
  await expect(visible(page.getByRole('switch'))).toHaveCount(1)
  await expect(toggle(page, 'Удаление царапин')).toHaveAttribute('aria-checked', 'false')
  await filter(page, 'Активные', 5).click()
  await expect(visible(page.getByRole('switch'))).toHaveCount(5)
  expect(
    fixture.calls
      .filter((call) => call.method === 'GET')
      .every((call) => call.tenantId === TENANT_ID),
  ).toBe(true)
  expect(fixture.writes()).toHaveLength(0)
})

test('list pending and failure are not an empty catalog; retry and refresh keep last data', async ({
  page,
}) => {
  test.setTimeout(60_000)
  fixture = await settingsServicesFixture(page)
  fixture.hold('list')
  await page.goto('/settings/services')
  await expect(page.getByRole('status', { name: 'Загрузка услуг', exact: true })).toBeVisible()
  await expect(page.getByText(/Услуг пока нет/)).toHaveCount(0)
  fixture.failures.set('list', 500)
  fixture.release('list')
  await expect(page.getByText('Не удалось загрузить услуги', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expect(filter(page, 'Все', 0)).toHaveCount(0)
  await expect(page.getByText(/Услуг пока нет/)).toHaveCount(0)
  fixture.failures.clear()
  await page.getByRole('button', { name: /Повторить/ }).click()
  await expect(toggle(page, 'Полировка кузова')).toBeVisible()
  fixture.hold('list')
  await refreshSettings(page)
  await expect(toggle(page, 'Полировка кузова')).toBeVisible()
  fixture.release('list')
  await expect(filter(page, 'Все', 6)).toBeVisible()
  fixture.failures.set('list', 500)
  await refreshSettings(page)
  await expect(page.getByRole('alert').filter({ hasText: /не удалось|не обнов/i })).toBeVisible({
    timeout: 20_000,
  })
  await expect(toggle(page, 'Полировка кузова')).toBeVisible()
  await expect(filter(page, 'Все', 6)).toBeVisible()
  await expect(page.getByText(/Услуг пока нет/)).toHaveCount(0)
})

test('empty catalog differs from empty filtered result', async ({ page }) => {
  fixture = await settingsServicesFixture(page, { empty: true })
  await page.goto('/settings/services')
  await expect(page.getByText(/Услуг пока нет/)).toBeVisible()
  await expect(add(page)).toBeEnabled()
  fixture.services.push({
    id: SERVICE_IDS[0]!,
    name: 'Только активная',
    normalizedName: 'только активная',
    locationId: null,
    priceFrom: null,
    priceTo: null,
    currency: 'RUB',
    active: true,
    createdAt: '',
    updatedAt: '',
  })
  await page.reload()
  await filter(page, 'Отключённые', 0).click()
  await expect(page.getByText('В этом фильтре услуг нет.', { exact: true })).toBeVisible()
  await expect(page.getByText(/Услуг пока нет/)).toHaveCount(0)
  expect(fixture.writes()).toHaveLength(0)
})

test('M03-01/02: create holds busy close paths, known error preserves draft, retry success edits response ID', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  await add(page).click()
  await fill(page)
  fixture.hold('create')
  fixture.failures.set('create', 422)
  await submitTwice(page)
  await expect.poll(() => fixture.writes('POST').length).toBe(1)
  const dialog = formDialog(page)
  for (const field of await dialog.locator('input,select').all()) await expect(field).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.mouse.click(2, 2)
  await expect(dialog).toBeVisible()
  fixture.release('create')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.locator('input[name=serviceName]')).toHaveValue('Мойка QA')
  expect(fixture.writes('POST')).toHaveLength(1)
  fixture.failures.delete('create')
  await dialog.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  await expect(dialog.locator('input,select,form')).toHaveCount(0)
  expect(fixture.writes('POST')).toHaveLength(2)
  expect(fixture.writes('POST')[1]).toEqual(fixture.writes('POST')[0])
  expect(fixture.writes('POST')[0]?.body).toEqual({
    name: 'Мойка QA',
    locationId: FIRST_LOCATION,
    priceFrom: '1490.50',
    priceTo: null,
    currency: 'RUB',
  })
  expect(fixture.services.filter((item) => item.name === 'Мойка QA')).toHaveLength(1)
  await dialog.getByRole('button', { name: 'Изменить услугу', exact: true }).click()
  await expect(dialog.locator('input[name=serviceName]')).toHaveValue('Мойка QA')
  await dialog.locator('input[name=priceFrom]').fill('')
  await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  expect(fixture.writes('POST')).toHaveLength(2)
  expect(fixture.writes('PATCH')).toHaveLength(1)
  expect(fixture.writes('PATCH')[0]).toMatchObject({
    path: `/api/v1/services/${CREATED_SERVICE_ID}`,
    tenantId: TENANT_ID,
    body: { priceFrom: null, priceTo: null },
  })
  await dialog.getByRole('button', { name: 'ОК', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(filter(page, 'Все', 7)).toBeVisible()
})

test('M03-02: edit busy locks and known rejection preserve values, retry updates same ID once', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  await edit(page, 'Полировка кузова').click()
  const dialog = formDialog(page)
  await dialog.locator('input[name=priceTo]').fill('32000')
  fixture.hold('update')
  fixture.failures.set('update', 400)
  await submitTwice(page)
  await expect.poll(() => fixture.writes('PATCH').length).toBe(1)
  await expect(dialog.locator('input[name=priceTo]')).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  fixture.release('update')
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.locator('input[name=priceTo]')).toHaveValue('32000')
  expect(fixture.services[0]?.priceTo).toBe('31000.00')
  fixture.failures.delete('update')
  await dialog.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  expect(fixture.writes('PATCH')).toHaveLength(2)
  expect(fixture.writes('PATCH')[1]).toEqual(fixture.writes('PATCH')[0])
  expect(fixture.writes('PATCH')[1]).toMatchObject({
    path: `/api/v1/services/${SERVICE_IDS[0]}`,
    tenantId: TENANT_ID,
    body: { priceFrom: '31000.00', priceTo: '32000.00' },
  })
  expect(fixture.writes('POST')).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(edit(page, 'Полировка кузова')).toBeFocused()
})

for (const failure of ['network', 500] as const) {
  test(`M03-01: unknown POST ${failure} never becomes success or another POST`, async ({
    page,
  }) => {
    fixture = await settingsServicesFixture(page)
    await open(page)
    fixture.failures.set('create', failure)
    await add(page).click()
    await fill(page)
    await submitTwice(page)
    const dialog = formDialog(page)
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toHaveCount(0)
    await expect(dialog.locator('input[name=serviceName]')).toHaveValue('Мойка QA')
    await submitTwice(page)
    expect(fixture.writes('POST')).toHaveLength(1)
    expect(fixture.services).toHaveLength(6)
  })
}

test('M03-03: cancel sends nothing; disable error/retry, counts, disappearing row focus and reactivation', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  await filter(page, 'Активные', 5).click()
  await toggle(page, 'Полировка кузова').click()
  const dialog = page.getByRole('dialog', { name: 'Отключить услугу?', exact: true })
  await dialog.getByRole('button', { name: 'Оставить активной', exact: true }).click()
  expect(fixture.writes()).toHaveLength(0)
  await expect(toggle(page, 'Полировка кузова')).toHaveAttribute('aria-checked', 'true')
  await toggle(page, 'Полировка кузова').click()
  fixture.hold('deactivate')
  fixture.failures.set('deactivate', 500)
  await dialog.getByRole('button', { name: 'Отключить', exact: true }).click()
  await expect.poll(() => fixture.writes('DELETE').length).toBe(1)
  await expect(dialog.getByRole('button', { name: 'Отключаем…', exact: true })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Оставить активной', exact: true }),
  ).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  fixture.release('deactivate')
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(fixture.services[0]?.active).toBe(true)
  fixture.failures.delete('deactivate')
  await dialog.getByRole('button', { name: 'Повторить отключение', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(toggle(page, 'Полировка кузова')).toHaveCount(0)
  await expect(filter(page, 'Активные', 4)).toBeVisible()
  await expect(filter(page, 'Отключённые', 2)).toBeVisible()
  expect(
    await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement | null
      return (
        !!focused &&
        focused !== document.body &&
        focused.isConnected &&
        !focused.closest('[inert],[hidden]')
      )
    }),
  ).toBe(true)
  await filter(page, 'Отключённые', 2).click()
  await toggle(page, 'Полировка кузова').click()
  await expect(toggle(page, 'Полировка кузова')).toHaveCount(0)
  await expect(filter(page, 'Активные', 5)).toBeVisible()
  expect(fixture.writes('PATCH')).toHaveLength(1)
  expect(fixture.writes('PATCH')[0]).toMatchObject({
    path: `/api/v1/services/${SERVICE_IDS[0]}`,
    tenantId: TENANT_ID,
    body: { active: true },
  })
  expect(fixture.writes('DELETE')).toHaveLength(2)
  expect(
    fixture
      .writes('DELETE')
      .every((call) => call.tenantId === TENANT_ID && call.path.endsWith(SERVICE_IDS[0]!)),
  ).toBe(true)
})

test('normal create/edit cancel, X and Escape restore the opener and trap keyboard focus', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  for (const exit of ['cancel', 'close', 'escape'] as const) {
    await add(page).click()
    const dialog = formDialog(page)
    await fill(page)
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab')
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    }
    if (exit === 'escape') await page.keyboard.press('Escape')
    else
      await dialog
        .getByRole('button', { name: exit === 'cancel' ? 'Отмена' : 'Закрыть', exact: true })
        .click()
    await expect(dialog).not.toBeVisible()
    await expect(add(page)).toBeFocused()
  }
  if (page.viewportSize()!.width >= 768) {
    await add(page).click()
    await page.mouse.click(2, 2)
    await expect(formDialog(page)).not.toBeVisible()
    await expect(add(page)).toBeFocused()
  }
  await edit(page, 'Полировка кузова').click()
  await expect(formDialog(page).locator('input[name=priceFrom]')).toHaveValue('31\u00a0000')
  await page.keyboard.press('Escape')
  await expect(edit(page, 'Полировка кузова')).toBeFocused()
  expect(fixture.writes()).toHaveLength(0)
})

test('late disable after leaving and returning never focuses the new service page', async ({
  page,
}) => {
  fixture = await settingsServicesFixture(page)
  await page.goto('/settings/company')
  await expect(page.getByRole('heading', { name: 'Компания и график', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Услуги', exact: true }).click()
  await expect(toggle(page, 'Полировка кузова')).toBeVisible()
  fixture.hold('deactivate')
  await toggle(page, 'Полировка кузова').click()
  await formDialog(page).getByRole('button', { name: 'Отключить', exact: true }).click()
  await expect(
    formDialog(page).getByRole('button', { name: 'Отключаем…', exact: true }),
  ).toBeDisabled()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Компания и график', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Услуги и цены', exact: true })).toBeVisible()
  await expect(formDialog(page)).toHaveCount(0)
  await expect(add(page)).toBeEnabled()
  // A pointer click on empty main padding leaves focus on the document, as in the reported race.
  await page.locator('main').click({ position: { x: 1, y: 1 } })
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  fixture.release('deactivate')
  await expect(filter(page, 'Активные', 4)).toBeVisible()
  await expect(toggle(page, 'Полировка кузова')).not.toBeChecked()
  await expect(add(page)).not.toBeFocused()
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  expect(fixture.writes('DELETE')).toHaveLength(1)
  expect(fixture.writes('DELETE')[0]?.tenantId).toBe(TENANT_ID)
})

test('MANAGER direct URL cannot read or mutate the owner service catalog', async ({ page }) => {
  fixture = await settingsServicesFixture(page, { role: 'MANAGER' })
  await page.goto('/settings/services')
  await expect(page.getByText('Раздел недоступен', { exact: true })).toBeVisible()
  await expect(add(page)).toHaveCount(0)
  expect(fixture.calls).toHaveLength(0)
})

test('tablet/mobile help works with touch and keyboard, Escape dismisses and touch targets stay 44px', async ({
  page,
}, info) => {
  fixture = await settingsServicesFixture(page)
  await open(page)
  const help = visible(
    page.getByRole('button', { name: 'Об отключении услуги и цене', exact: true }),
  ).first()
  await help.focus()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  if (info.project.use.hasTouch) await help.tap()
  else await help.click()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await page.keyboard.press('Escape')
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    for (const action of [
      add(page),
      edit(page, 'Полировка кузова'),
      toggle(page, 'Полировка кузова'),
      help,
    ]) {
      const rect = await action.boundingBox()
      expect(rect!.width).toBeGreaterThanOrEqual(44)
      expect(rect!.height).toBeGreaterThanOrEqual(44)
    }
  }
})

test('narrow and adjacent breakpoints retain long data/actions without document overflow; low height dialogs scroll', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium', 'One Chromium run owns the explicit viewport matrix')
  fixture = await settingsServicesFixture(page, { longNames: true })
  for (const width of [320, 375, 390, 767, 768, 833, 834, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 600 })
    await open(page)
    await expect(toggle(page, fixture.services[0]!.name)).toBeVisible()
    await noOverflow(page)
  }
  for (const width of [320, 834]) {
    await page.setViewportSize({ width, height: 420 })
    for (const mode of ['create', 'edit', 'disable'] as const) {
      if (mode === 'create') await add(page).click()
      if (mode === 'edit') await edit(page, fixture.services[0]!.name).click()
      if (mode === 'disable') await toggle(page, fixture.services[0]!.name).click()
      const dialog = formDialog(page)
      if (mode !== 'disable') {
        await dialog.locator('input[name=priceTo]').focus()
        await inViewport(page, dialog.locator('input[name=priceTo]'))
        await inViewport(page, dialog.locator('button[type=submit]'))
      } else await inViewport(page, dialog.getByRole('button', { name: 'Отключить', exact: true }))
      await noOverflow(page)
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
      await expect(dialog).not.toBeVisible()
    }
  }
  expect(fixture.writes()).toHaveLength(0)
})
