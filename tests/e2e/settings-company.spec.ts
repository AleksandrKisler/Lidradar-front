import { expect, test, type Page } from '@playwright/test'
import {
  openSettings,
  refreshSettings,
  settingsFixture,
  type SettingsFixture,
} from './fixtures/settings-company'

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
let fixture: SettingsFixture
test.afterEach(() => fixture?.dispose())

/** Point cards expose location and activity; schedule copy belongs to the editor. */
async function selectSecondSettingsLocation(page: Page) {
  await page
    .getByRole('list', { name: 'Список точек' })
    .getByRole('button', { name: 'Студия на Арбате Активна', exact: true })
    .click()
}

test('settings first load stays pending until responses, then independent failure can retry', async ({
  page,
}) => {
  test.setTimeout(60_000)
  fixture = await settingsFixture(page)
  fixture.hold('company')
  fixture.hold('locations')
  await page.goto('/settings/company')
  await expect(page.getByRole('status', { name: 'Загрузка компании', exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Загрузка точек', exact: true })).toBeVisible()
  await expect(page.locator('input[name=organizationName]')).toHaveCount(0)
  expect(fixture.writes()).toHaveLength(0)
  fixture.failures.add('company')
  fixture.release('company')
  fixture.release('locations')
  await expect(page.locator('input[name=opens-1]')).toBeVisible()
  await expect(page.getByText('Не удалось загрузить компанию', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  fixture.failures.clear()
  await page
    .locator('section[aria-labelledby=company-title]')
    .getByRole('button', { name: /Повторить/ })
    .click()
  await expect(page.locator('input[name=organizationName]')).toHaveValue('Студия «Блик»')
  expect(fixture.writes()).toHaveLength(0)
})

test('US-M02-05: company name, confirmation cancel, busy failure and explicit retry', async ({
  page,
}) => {
  fixture = await settingsFixture(page)
  await openSettings(page)
  const save = page.getByRole('button', { name: 'Сохранить компанию', exact: true })
  await expect(save).toBeDisabled()
  await page.locator('input[name=organizationName]').fill('Студия QA')
  fixture.failures.add('company')
  fixture.hold('company')
  await save.click()
  await expect.poll(() => fixture.writes('company').length).toBe(1)
  await expect(page.locator('input[name=organizationName]')).toBeDisabled()
  await page
    .locator('input[name=organizationName]')
    .evaluate((element) => (element.closest('form') as HTMLFormElement).requestSubmit())
  fixture.release('company')
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(fixture.writes('company')).toHaveLength(1)
  await expect(page.locator('input[name=organizationName]')).toHaveValue('Студия QA')
  fixture.failures.delete('company')
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
  await expect(page.getByText('Настройки компании сохранены.', { exact: true })).toBeVisible()
  await expect(save).toBeDisabled()
  const narrow = (page.viewportSize()?.width ?? 1440) < 1024
  if (narrow) await page.getByRole('button', { name: 'Меню', exact: true }).click()
  await expect(
    page.getByText('Студия QA', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible()
  if (narrow) await page.keyboard.press('Escape')
  expect(fixture.writes('company')[1]?.body).toEqual({ name: 'Студия QA' })
  await page.locator('select[name=organizationTimezone]').selectOption('Europe/Kaliningrad')
  await save.click()
  const dialog = page.getByRole('dialog', { name: 'Изменить валюту и часовой пояс?', exact: true })
  await expect(dialog).toBeVisible()
  expect(fixture.writes('company')).toHaveLength(2)
  await dialog.getByRole('button', { name: 'Оставить прежние', exact: true }).click()
  await expect(page.locator('select[name=organizationTimezone]')).toHaveValue('Europe/Moscow')
  await page.locator('select[name=organizationTimezone]').selectOption('Europe/Kaliningrad')
  await save.click()
  await dialog.getByRole('button', { name: 'Сохранить изменения', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await expect(page.locator('select[name=organizationTimezone]')).toHaveValue('Europe/Kaliningrad')
})

test('US-M02-06: empty state, validation, one create despite duplicate submit, edit inactive', async ({
  page,
}) => {
  fixture = await settingsFixture(page, { empty: true })
  await openSettings(page)
  await expect(page.getByRole('heading', { name: 'Точек пока нет', exact: true })).toBeVisible()
  await expect(page.locator('input[name^="opens-"], input[name^="closes-"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  expect(fixture.writes()).toHaveLength(0)
  await expect(dialog.locator('input[name=locationName]')).toHaveAttribute('aria-invalid', 'true')
  await dialog.locator('input[name=locationName]').fill('Студия QA 2')
  await dialog.locator('input[name=responseThresholdMinutes]').fill('0')
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  await expect(dialog.locator('input[name=responseThresholdMinutes]')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(fixture.writes()).toHaveLength(0)
  await dialog.locator('input[name=responseThresholdMinutes]').fill('45')
  fixture.hold('locations')
  fixture.failures.add('locations')
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  await expect.poll(() => fixture.writes('locations').length).toBe(1)
  await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  fixture.release('locations')
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(fixture.writes('locations')).toHaveLength(1)
  await expect(dialog.locator('input[name=locationName]')).toHaveValue('Студия QA 2')
  fixture.failures.delete('locations')
  await dialog.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'ОК', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(fixture.locations).toHaveLength(1)
  expect(fixture.locations[0]?.businessHours).toEqual([])
  await page
    .getByRole('button', { name: 'Изменить точку', exact: true })
    .filter({ visible: true })
    .first()
    .click()
  const edit = page.getByRole('dialog', { name: 'Изменить точку', exact: true })
  await edit.locator('select[name=locationActive]').selectOption('inactive')
  await edit.getByRole('button', { name: 'Сохранить точку', exact: true }).click()
  await expect(edit.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  await edit.getByRole('button', { name: 'ОК', exact: true }).click()
  await expect(edit).not.toBeVisible()
  await expect(page.getByText('Неактивна', { exact: true }).filter({ visible: true })).toBeVisible()
  expect(fixture.writes('location')[0]?.body).toEqual({ active: false })
})

test('US-M02-06: retained draft on refresh failure, retry, atomic week busy and retry', async ({
  page,
}) => {
  test.setTimeout(60_000)
  fixture = await settingsFixture(page)
  await openSettings(page)
  const opening = page.locator('input[name=opens-1]')
  await opening.fill('10:00')
  fixture.hold('company')
  fixture.hold('locations')
  await refreshSettings(page)
  await expect(
    page.getByText('Обновляем данные. Предыдущие значения остаются на экране.', { exact: true }),
  ).toBeVisible()
  await expect(opening).toHaveValue('10:00')
  fixture.failures.add('company')
  fixture.failures.add('locations')
  fixture.release('company')
  fixture.release('locations')
  await expect(page.getByRole('button', { name: 'Повторить обновление', exact: true })).toBeVisible(
    { timeout: 20_000 },
  )
  await expect(opening).toHaveValue('10:00')
  fixture.failures.clear()
  await page.getByRole('button', { name: 'Повторить обновление', exact: true }).click()
  await expect(page.getByText('Параметры компании не обновлены', { exact: true })).not.toBeVisible()
  await expect(opening).toHaveValue('10:00')
  fixture.hold('week')
  fixture.failures.add('week')
  await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
  await expect.poll(() => fixture.writes('week').length).toBe(1)
  await expect(opening).toBeDisabled()
  await opening.evaluate((element) => (element.closest('form') as HTMLFormElement).requestSubmit())
  fixture.release('week')
  await expect(
    page.locator('section[aria-labelledby=schedule-title]').getByRole('alert'),
  ).toBeVisible()
  expect(fixture.writes('week')).toHaveLength(1)
  await expect(opening).toHaveValue('10:00')
  fixture.failures.clear()
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
  await expect(page.getByText('График сохранён.', { exact: true })).toBeVisible()
  const payload = fixture.writes('week')[1]?.body as { days: unknown[] }
  expect(payload.days).toHaveLength(7)
  expect(payload.days[0]).toMatchObject({ weekday: 1, opensAt: '10:00', closesAt: '20:00' })
})

test('US-M02-06: invalid week blocks writes, copy respects source and closed days, switch/route cancel restore focus', async ({
  page,
}) => {
  fixture = await settingsFixture(page)
  await openSettings(page)
  const opening = page.locator('input[name=opens-1]')
  const copy = page.getByRole('button', {
    name: /Скопировать часы первого рабочего дня|Применить ко всем рабочим дням/,
  })
  await expect(copy).toBeDisabled()
  await opening.fill('21:00')
  await expect(copy).toBeDisabled()
  await page.getByRole('button', { name: 'Сохранить график', exact: true }).click()
  await expect(page.locator('input[name=closes-1]')).toHaveAttribute('aria-invalid', 'true')
  expect(fixture.writes()).toHaveLength(0)
  await opening.fill('10:00')
  await expect(copy).toBeEnabled()
  await copy.click()
  await expect(page.locator('input[name=opens-2]')).toHaveValue('10:00')
  await expect(page.locator('input[name=day-6]')).not.toBeChecked()
  await expect(copy).toBeDisabled()
  await selectSecondSettingsLocation(page)
  const dialog = page.getByRole('dialog', { name: 'Сохранить изменения графика?', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'К редактированию', exact: true }).click()
  await expect(opening).toHaveValue('10:00')
  await expect(
    page.getByRole('button', { name: 'Студия на Тверской Активна', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: 'Студия на Арбате Активна', exact: true }),
  ).toBeFocused()
  const routeLink = page
    .getByRole('navigation', { name: 'Разделы настроек' })
    .getByRole('link', { name: 'Услуги', exact: true })
  await routeLink.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/settings\/company$/)
  await expect(routeLink).toBeFocused()
  expect(fixture.writes()).toHaveLength(0)
  await selectSecondSettingsLocation(page)
  await dialog.getByRole('button', { name: 'Продолжить без сохранения', exact: true }).click()
  await expect(opening).toHaveValue('09:00')
})

test('US-M02-06: creating another point retains selected schedule', async ({ page }) => {
  fixture = await settingsFixture(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
  await dialog.locator('input[name=locationName]').fill('Студия QA 3')
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'ОК', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Студия на Тверской Активна', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const radar = page.getByRole('link', { name: 'Radar', exact: true }).filter({ visible: true })
  if (!(await radar.count())) await page.getByRole('button', { name: 'Меню', exact: true }).click()
  await page.getByRole('link', { name: 'Radar', exact: true }).filter({ visible: true }).click()
  if ((page.viewportSize()?.width ?? 1440) < 1024)
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Точка', exact: true })).toHaveValue('')
})

test('US-M02-06: workspace switch confirms before discarding a dirty week and cancel restores selection/focus', async ({
  page,
}) => {
  fixture = await settingsFixture(page)
  const authResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/auth/me') && response.ok(),
  )
  await openSettings(page)
  const auth = (await (await authResponse).json()) as {
    memberships: { tenantId: string }[]
    [key: string]: unknown
  }
  const tenantA = auth.memberships[0]!.tenantId
  const tenantB = '01990000-0000-7000-8000-000000000002'
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        ...auth,
        memberships: [
          ...auth.memberships,
          { tenantId: tenantB, organizationName: 'Другая компания', role: 'OWNER' },
        ],
      },
    }),
  )
  await page.reload()
  await expect(page.locator('input[name=organizationName]')).toBeVisible()
  const workspace = page.getByRole('combobox', { name: 'Рабочее пространство', exact: true })
  if (!(await workspace.isVisible()))
    await page.getByRole('button', { name: 'Меню', exact: true }).click()
  await expect(workspace).toHaveValue(tenantA)
  // Close the adaptive menu to edit, if needed; no new mobile design is accepted here.
  if ((page.viewportSize()?.width ?? 1440) < 1024) await page.keyboard.press('Escape')
  await page.locator('input[name=opens-1]').fill('10:00')
  if (!(await workspace.isVisible()))
    await page.getByRole('button', { name: 'Меню', exact: true }).click()
  await workspace.selectOption(tenantB)
  const confirm = page.getByRole('dialog', { name: 'Сохранить изменения графика?', exact: true })
  await expect(confirm).toBeVisible()
  expect(fixture.writes()).toHaveLength(0)
  await confirm.getByRole('button', { name: 'К редактированию', exact: true }).click()
  await expect(workspace).toHaveValue(tenantA)
  await expect(workspace).toBeFocused()
  await expect(page).toHaveURL(/\/settings\/company$/)
  await expect(page.locator('input[name=opens-1]')).toHaveValue('10:00')
  await workspace.selectOption(tenantB)
  await confirm.getByRole('button', { name: 'Продолжить без сохранения', exact: true }).click()
  await expect(page).toHaveURL(/\/radar$/)
  if (!(await workspace.isVisible()))
    await page.getByRole('button', { name: 'Меню', exact: true }).click()
  await expect(workspace).toHaveValue(tenantB)
  expect(fixture.writes()).toHaveLength(0)
})

test('US-M02-05: manager direct URL cannot expose company mutations', async ({ page }) => {
  fixture = await settingsFixture(page, { role: 'MANAGER' })
  await page.goto('/settings/company')
  await expect(page.locator('main#main')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить компанию', exact: true })).toHaveCount(0)
  await expect(page.locator('input[name=organizationName]')).toHaveCount(0)
  expect(fixture.writes()).toHaveLength(0)
})

for (const width of [320, 344, 375, 390, 768, 834, 1023, 1024, 1440]) {
  test(`settings controls fit ${width} with long location names`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    fixture = await settingsFixture(page, { longNames: true })
    await openSettings(page)
    await page.locator('input[name=organizationName]').fill('QA1 · Средний детейлинг')
    for (const badge of await page.locator('[data-testid$="-status"]').all()) {
      const geometry = await badge.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const text = [...element.childNodes].filter(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        )
        const rects = text.flatMap((node) => {
          const range = document.createRange()
          range.selectNodeContents(node)
          return [...range.getClientRects()].map((rect) => ({ top: rect.top, bottom: rect.bottom }))
        })
        return {
          whiteSpace: getComputedStyle(element).whiteSpace,
          height: box.height,
          textHeight:
            Math.max(...rects.map((rect) => rect.bottom)) -
            Math.min(...rects.map((rect) => rect.top)),
        }
      })
      expect(geometry.whiteSpace).toBe('nowrap')
      expect(geometry.height).toBe(28)
      expect(geometry.textHeight).toBeLessThanOrEqual(18)
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBe(0)
    await expect(page.locator('#schedule-location')).toHaveCount(0)
    await expect(
      page.getByRole('list', { name: 'Список точек' }).getByRole('button', { pressed: true }),
    ).toHaveCount(1)
    const bounds = await page
      .locator('main select, main input[name^="opens-"], main input[name^="closes-"]')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length)
          .map((element) => {
            const box = element.getBoundingClientRect()
            return { left: box.left, right: box.right, width: box.width, viewport: innerWidth }
          }),
      )
    for (const box of bounds) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(box.viewport)
      expect(box.width).toBeGreaterThan(0)
    }
    const timezone = await page.locator('select[name=organizationTimezone]').evaluate((select) => {
      const style = getComputedStyle(select)
      const context = document.createElement('canvas').getContext('2d')!
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      return {
        label: context.measureText((select as HTMLSelectElement).selectedOptions[0]!.label).width,
        available:
          select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      }
    })
    expect(
      timezone.available,
      `selected timezone must remain readable at ${width}px`,
    ).toBeGreaterThanOrEqual(Math.ceil(timezone.label))
    if (width < 768) {
      const opens = await page.locator('input[name="opens-1"]').boundingBox()
      const closes = await page.locator('input[name="closes-1"]').boundingBox()
      expect(opens!.width).toBeCloseTo(closes!.width, 1)
      if (width === 390) expect(opens!.width).toBe(132)
    }
  })
}

test('N-SC-ADAPTIVE-01: confirmed create success edits the same ID without a second POST', async ({
  page,
}) => {
  fixture = await settingsFixture(page)
  await openSettings(page)
  const addButton = page.getByRole('button', { name: 'Добавить точку', exact: true })
  await addButton.click()
  let dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
  await dialog.getByLabel('Название точки', { exact: true }).fill('Студия после успеха')
  fixture.hold('locations')
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  await expect.poll(() => fixture.writes('locations').length).toBe(1)
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
  fixture.release('locations')
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  const created = fixture.locations.find((location) => location.name === 'Студия после успеха')!
  expect(fixture.writes('locations')[0]?.body).toMatchObject({ name: created.name })
  await dialog.getByRole('button', { name: 'Изменить точку', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Изменить точку', exact: true })
  await expect(dialog.getByLabel('Название точки', { exact: true })).toHaveValue(created.name)
  await dialog.getByLabel('Нет ответа', { exact: true }).fill('47')
  await dialog.getByRole('button', { name: 'Сохранить точку', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'ОК', exact: true })).toBeVisible()
  expect(fixture.writes('locations')).toHaveLength(1)
  expect(fixture.writes('location')).toHaveLength(1)
  expect(fixture.writes('location')[0]).toMatchObject({
    path: `/api/v1/locations/${created.id}`,
    body: { responseThresholdMinutes: 47 },
  })
  await dialog.getByRole('button', { name: 'ОК', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(addButton).toBeFocused()
})

for (const kind of ['company', 'schedule'] as const) {
  test(`N-SC-ADAPTIVE-01: ${kind} feedback expires at 2000ms; error retains draft and explicit retry`, async ({
    page,
  }) => {
    fixture = await settingsFixture(page)
    await page.clock.install({ time: new Date('2026-10-25T11:30:00Z') })
    await page.clock.pauseAt(new Date('2026-10-25T11:30:01Z'))
    await openSettings(page)
    const company = kind === 'company'
    const endpoint = company ? 'company' : 'week'
    const input = page.locator(company ? 'input[name=organizationName]' : 'input[name=opens-1]')
    const draft = company ? 'Компания с черновиком' : '10:00'
    const badge = page.getByTestId(`settings-${kind}-status`)
    const save = page.getByRole('button', {
      name: company ? 'Сохранить компанию' : 'Сохранить график',
      exact: true,
    })
    await input.fill(draft)
    fixture.failures.add(endpoint)
    await save.click()
    // vee-validate batches schema validation with a 5ms timer; no request exists before it.
    if (company) await page.clock.runFor(5)
    await expect(badge).toHaveText('Ошибка сохранения')
    await page.clock.runFor(1999)
    await expect(badge).toHaveText('Ошибка сохранения')
    await page.clock.runFor(1)
    await expect(badge).toHaveText(company ? 'Не сохранено' : 'Не сохранён')
    const section = page.locator(
      `section[aria-labelledby=${company ? 'company-title' : 'schedule-title'}]`,
    )
    await expect(section.getByRole('alert')).toBeVisible()
    await expect(input).toHaveValue(draft)
    expect(fixture.writes(endpoint)).toHaveLength(1)
    fixture.failures.delete(endpoint)
    await section.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
    // vee-validate batches schema validation with a 5ms timer; no request exists before it.
    if (company) await page.clock.runFor(5)
    await expect(badge).toHaveText('Сохранено')
    await page.clock.runFor(1999)
    await expect(badge).toHaveText('Сохранено')
    await page.clock.runFor(1)
    await expect(badge).toHaveText('Изменений нет')
    expect(fixture.writes(endpoint)).toHaveLength(2)
    await expect(input).toHaveValue(draft)
  })
}

test.describe('adaptive touch interactions', () => {
  test.use({ hasTouch: true })

  test('N-SC-ADAPTIVE-01: mobile touch help, keyboard focus return and tabs scroll inside their viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    fixture = await settingsFixture(page, { longNames: true })
    await openSettings(page)
    const navigation = page.getByRole('navigation', { name: 'Разделы настроек' })
    const lastTab = navigation.getByRole('link').last()
    await lastTab.focus()
    await expect(lastTab).toBeInViewport()
    expect(await navigation.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    const add = page.getByRole('button', { name: 'Добавить точку', exact: true })
    await add.click()
    const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
    const help = dialog.getByRole('button', { name: 'О поле «Нет ответа»', exact: true })
    const box = await help.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await help.tap()
    await expect(page.getByRole('tooltip')).toContainText('Вне графика точки время не считается')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Название точки', { exact: true }).focus()
    await help.focus()
    await expect(page.getByRole('tooltip')).toBeVisible()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(add).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  })
})

test('N-SC-ADAPTIVE-01: unknown create outcome cannot issue a second POST', async ({ page }) => {
  fixture = await settingsFixture(page)
  await openSettings(page)
  let posts = 0
  await page.route('**/api/v1/locations', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    posts += 1
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Добавить точку', exact: true })
  await dialog.getByLabel('Название точки', { exact: true }).fill('Неизвестный исход')
  await dialog.getByRole('button', { name: 'Добавить точку', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Результат создания неизвестен')
  await expect(dialog.getByRole('button', { name: 'Требуется сверка', exact: true })).toBeDisabled()
  await dialog.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(dialog.getByLabel('Название точки', { exact: true })).toHaveValue(
    'Неизвестный исход',
  )
  expect(posts).toBe(1)
})
