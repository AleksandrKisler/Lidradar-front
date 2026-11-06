import { expect, test, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFileSync } from 'node:fs'
import { TENANT_ID } from './fixtures/api'
import {
  openPrivacyDialog,
  PRIVACY_LONG_NAME,
  PRIVACY_NOW,
  PRIVACY_OTHER_TENANT,
  privacyDialog,
  refreshPrivacy,
  settingsPrivacyFixture,
} from './fixtures/settings-privacy'

test.beforeEach(async ({ page }) => {
  if (!process.env.PRIVACY_FOCUS_PROBE) return
  await page.addInitScript(() => {
    const state = window as unknown as { privacyFocusLog: unknown[] }
    state.privacyFocusLog = []
    const original = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function (options?: FocusOptions) {
      state.privacyFocusLog.push({
        event: 'focus()',
        target: this.outerHTML.slice(0, 500),
        time: performance.now(),
      })
      original.call(this, options)
    }
    document.addEventListener('focusin', (event) =>
      state.privacyFocusLog.push({
        event: 'focusin',
        target: (event.target as HTMLElement).outerHTML.slice(0, 500),
        time: performance.now(),
      }),
    )
  })
})
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return
  const diagnostic = await page
    .evaluate(() => ({
      activeElement: document.activeElement?.outerHTML.slice(0, 1000),
      documentHasFocus: document.hasFocus(),
      log: (window as unknown as { privacyFocusLog?: unknown[] }).privacyFocusLog,
    }))
    .catch(() => ({ unavailable: true }))
  const path = info.outputPath('focus-diagnostic.json')
  writeFileSync(path, JSON.stringify(diagnostic, null, 2))
  await info.attach('focus-diagnostic', { path, contentType: 'application/json' })
})

async function capture(page: Page, testInfo: TestInfo, state: string) {
  await page.evaluate(() => document.fonts.ready)
  const path = testInfo.outputPath(`${state}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await testInfo.attach(state, { path, contentType: 'image/png' })
}
async function ready(page: Page) {
  await page.goto('/settings/privacy')
  await expect(
    page.getByRole('heading', { name: 'Данные и конфиденциальность', exact: true }),
  ).toBeVisible()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const initial of ['never', 'active', 'revoked'] as const) {
  test(`R57 ${initial}: real status/history and legal/account links, no writes`, async ({
    page,
  }, testInfo) => {
    const fixture = await settingsPrivacyFixture(page, { initial })
    try {
      await ready(page)
      const consent = page.getByRole('region', { name: 'Обучение моделей', exact: true })
      await expect(consent).toContainText(initial === 'active' ? 'Действует' : 'Не дано')
      if (initial === 'never') await expect(consent).toContainText('Согласие ещё не выдавалось.')
      else {
        await expect(consent).toContainText('Выдано')
        if (initial === 'revoked') {
          await expect(consent).toContainText('Отозвано')
          await expect(consent).toContainText(PRIVACY_LONG_NAME)
        } else await expect(consent).toContainText('10:24')
      }
      await expect(
        page.getByRole('button', {
          name: initial === 'active' ? 'Отозвать согласие' : 'Дать согласие',
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByTestId('export-organization')).toHaveText('Скачать архив ZIP')
      const documents = page.getByRole('region', { name: 'Документы', exact: true })
      await expect(documents.getByRole('link')).toHaveCount(4)
      for (const link of await documents.getByRole('link').all()) {
        await expect(link).toHaveAttribute('href', /^\/legal\//)
        await expect(link).toHaveAttribute('rel', /noopener/)
      }
      await expect(page.getByRole('link', { name: /Открыть аккаунт/ })).toHaveAttribute(
        'href',
        '/settings/account',
      )
      expect(fixture.writes()).toEqual([])
      expect(fixture.calls.every((call) => call.tenant === TENANT_ID)).toBe(true)
      await capture(page, testInfo, `main-${initial}`)
      await page.getByRole('link', { name: /Открыть аккаунт/ }).click()
      await expect(page).toHaveURL(/\/settings\/account$/)
      await expect(page.getByRole('heading', { name: 'Мои данные', exact: true })).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Удаление аккаунта', exact: true }),
      ).toBeVisible()
      await expect(page.getByTestId('export-account-open')).toBeVisible()
      await expect(page.getByTestId('deletion-open')).toBeVisible()
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

test('R57 loading, initial read error and retry never invent a decision', async ({
  page,
}, testInfo) => {
  const fixture = await settingsPrivacyFixture(page)
  fixture.hold('read')
  fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
  try {
    await ready(page)
    await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toHaveCount(0)
    await capture(page, testInfo, 'main-loading')
    fixture.release('read')
    await expect(page.getByText('! Не удалось загрузить статус', { exact: true })).toBeVisible()
    await expect(page.getByText('Статус неизвестен', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('export-organization')).toBeEnabled()
    await capture(page, testInfo, 'main-load-error')
    fixture.failures.delete('read')
    await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
    await expect(page.getByText('Согласие ещё не выдавалось.', { exact: true })).toBeVisible()
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('R57 failed refresh preserves active history, blocks mutation and recovers', async ({
  page,
}, testInfo) => {
  const fixture = await settingsPrivacyFixture(page, { initial: 'active' })
  try {
    await ready(page)
    await expect(page.getByRole('button', { name: 'Отозвать согласие', exact: true })).toBeVisible()
    fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
    await refreshPrivacy(page)
    await expect(page.getByText('! Статус не обновлён', { exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Обучение моделей', exact: true })).toContainText(
      '10:24',
    )
    const revoke = page.getByRole('button', { name: 'Отозвать согласие', exact: true })
    if (await revoke.count()) await expect(revoke).toBeDisabled()
    await capture(page, testInfo, 'main-refresh-error')
    fixture.failures.delete('read')
    await page.getByRole('button', { name: 'Обновить статус', exact: true }).click()
    await expect(page.getByText('! Статус не обновлён', { exact: true })).toHaveCount(0)
    await expect(revoke).toBeEnabled()
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

for (const kind of ['grant', 'revoke'] as const) {
  test(`R57 ${kind}: confirm, error, retry, saving, success and one tenant command`, async ({
    page,
  }, testInfo) => {
    const fixture = await settingsPrivacyFixture(page, {
      initial: kind === 'grant' ? 'never' : 'active',
    })
    try {
      await ready(page)
      const dialog = await openPrivacyDialog(page, kind)
      expect(fixture.writes()).toHaveLength(0)
      await capture(page, testInfo, `${kind}-confirm`)
      if (kind === 'grant') {
        await expect(dialog).toContainText('90 до 365 дней')
        await expect(dialog).toContainText('можно отозвать')
      } else await expect(dialog).toContainText('История выдачи и отзыва согласия сохранится')
      const command = kind === 'grant' ? 'Дать согласие' : 'Отозвать'
      fixture.failures.set(kind, { status: 500, code: 'INTERNAL_ERROR' })
      await dialog.getByRole('button', { name: command, exact: true }).click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      await expect(dialog.getByRole('alert')).not.toContainText('raw-private-error')
      await expect(dialog.getByRole('button', { name: 'Повторить', exact: true })).toBeEnabled()
      await capture(page, testInfo, `${kind}-error`)
      fixture.failures.delete(kind)
      fixture.hold(kind)
      await dialog.getByRole('button', { name: 'Повторить', exact: true }).click()
      await expect.poll(() => fixture.writes(kind).length).toBe(2)
      await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
      await expect(
        dialog.getByText(kind === 'grant' ? 'Сохраняем…' : 'Отзываем…', { exact: true }),
      ).toBeVisible()
      await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      const close = dialog.getByRole('button', { name: 'Закрыть', exact: true })
      // R57 mobile keeps the source close affordance visible and disabled while saving.
      await expect(close).toBeVisible()
      await expect(close).toBeDisabled()
      await capture(page, testInfo, `${kind}-saving`)
      expect(fixture.writes(kind)).toHaveLength(2)
      fixture.release(kind)
      await expect(dialog).toHaveCount(0)
      const notice = page
        .getByRole('status')
        .filter({ hasText: kind === 'grant' ? 'Согласие выдано' : 'Согласие отозвано' })
      await expect(notice).toBeVisible()
      await expect(
        page.getByRole('button', {
          name: kind === 'grant' ? 'Отозвать согласие' : 'Дать согласие',
          exact: true,
        }),
      ).toBeEnabled()
      expect(
        fixture
          .writes(kind)
          .every(
            (call) =>
              call.tenant === TENANT_ID &&
              call.body === null &&
              call.method === (kind === 'grant' ? 'POST' : 'DELETE'),
          ),
      ).toBe(true)
      await capture(page, testInfo, `main-${kind}-saved`)
    } finally {
      fixture.dispose()
    }
  })

  test(`R57 ${kind}: keyboard trap, Escape/cancel and return focus without requests`, async ({
    page,
  }) => {
    const fixture = await settingsPrivacyFixture(page, {
      initial: kind === 'grant' ? 'never' : 'active',
    })
    try {
      await ready(page)
      const trigger = page.getByRole('button', {
        name: kind === 'grant' ? 'Дать согласие' : 'Отозвать согласие',
        exact: true,
      })
      const dialog = await openPrivacyDialog(page, kind)
      for (let step = 0; step < 10; step++) {
        await page.keyboard.press(step % 2 ? 'Shift+Tab' : 'Tab')
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
      }
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await openPrivacyDialog(page, kind)
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
      await expect(trigger).toBeFocused()
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

test('R57 readonly active status has no forbidden writes or member reads', async ({
  page,
}, testInfo) => {
  const memberReads: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/organization/members')) memberReads.push(request.url())
  })
  const fixture = await settingsPrivacyFixture(page, { initial: 'active', manager: true })
  try {
    await ready(page)
    await expect(
      page.getByText('Изменить согласие может владелец организации.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/Архив компании доступен владельцу/)).toBeVisible()
    const navigation = page.getByRole('navigation', {
      name: 'Разделы настроек',
      includeHidden: true,
    })
    for (const label of ['Компания и график', 'Услуги', 'Команда']) {
      const item = navigation.getByRole('link', { name: label, exact: true, includeHidden: true })
      await expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(await item.getAttribute('href')).toBeNull()
      await item.dispatchEvent('click')
      await expect(page).toHaveURL(/\/settings\/privacy$/)
    }
    await expect(navigation.locator('li')).toHaveCount(6)
    const selector = page.getByLabel('Раздел настроек', { exact: true })
    await expect(navigation.locator('a')).toHaveCount(3)
    if (page.viewportSize()!.width < 1024) await expect(selector).toHaveCount(0)
    else await expect(selector.locator('option')).toHaveCount(3)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

    await expect(
      page.getByRole('button', { name: /Дать согласие|Отозвать согласие|Скачать архив/ }),
    ).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Обучение моделей', exact: true })).toContainText(
      'участник организации',
    )
    expect(fixture.writes()).toEqual([])
    expect(memberReads).toEqual([])
    await capture(page, testInfo, 'main-readonly')
  } finally {
    fixture.dispose()
  }
})

test('R57 archive preparing, error retry and confirmed filename/size download', async ({
  page,
}, testInfo) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    fixture.failures.set('export', { status: 500, code: 'INTERNAL_ERROR' })
    const action = page.getByTestId('export-organization')
    await action.click()
    await expect(page.getByTestId('export-organization-error')).toBeVisible()
    await expect(page.getByTestId('export-organization-error')).not.toContainText(
      'raw-private-error',
    )
    await expect(page.getByTestId('export-organization-saved')).toHaveCount(0)
    await capture(page, testInfo, 'main-archive-error')
    fixture.failures.delete('export')
    fixture.hold('export')
    const downloads: string[] = []
    page.on('download', (file) => downloads.push(file.suggestedFilename()))
    await action.click()
    await expect(action).toHaveText('Готовим архив…')
    await expect(action).toBeDisabled()
    await expect(action).toHaveAttribute('aria-busy', 'true')
    expect(downloads).toEqual([])
    await capture(page, testInfo, 'main-archive-preparing')
    const download = page.waitForEvent('download')
    fixture.release('export')
    expect((await download).suggestedFilename()).toBe(fixture.archive.filename)
    const saved = page.getByTestId('export-organization-saved')
    await expect(saved).toContainText('Архив готов')
    await expect(saved).toContainText(fixture.archive.filename)
    await expect(saved).toContainText('22')
    await expect(saved).toContainText('Файл передан браузеру для скачивания')
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    expect(fixture.writes('export')).toHaveLength(2)
    expect(
      fixture
        .writes('export')
        .every((call) => call.method === 'POST' && call.tenant === TENANT_ID && call.body === null),
    ).toBe(true)
    await capture(page, testInfo, 'main-archive-saved')
  } finally {
    fixture.dispose()
  }
})

for (const [code, title, seconds, label] of [
  ['EXPORT_BUSY', 'Сейчас нельзя начать выгрузку', 30, '30 секунд'],
  ['RATE_LIMITED', 'Лимит выгрузок достигнут', 1080, '18 минут'],
] as const) {
  test(`R57 ${code} cooldown respects Retry-After without resending`, async ({
    page,
  }, testInfo) => {
    const fixture = await settingsPrivacyFixture(page)
    await page.clock.install({ time: new Date(PRIVACY_NOW) })
    await page.clock.pauseAt(new Date(PRIVACY_NOW))
    try {
      fixture.failures.set('export', { status: 429, code, retryAfter: String(seconds) })
      await ready(page)
      const action = page.getByTestId('export-organization')
      await action.click()
      await expect(page.getByTestId('export-organization-error')).toContainText(title)
      await expect(page.getByTestId('export-organization-error')).toContainText(label)
      await expect(action).toBeDisabled()
      await page.clock.runFor(seconds * 1000 - 1)
      expect(fixture.writes('export')).toHaveLength(1)
      await expect(action).toBeDisabled()
      await capture(
        page,
        testInfo,
        code === 'EXPORT_BUSY' ? 'main-archive-busy' : 'main-archive-limit',
      )
      fixture.failures.delete('export')
      await page.clock.runFor(1001)
      await expect(action).toBeEnabled()
      const download = page.waitForEvent('download')
      await action.click()
      await download
      expect(fixture.writes('export')).toHaveLength(2)
    } finally {
      fixture.dispose()
    }
  })
}

test('R57403 refresh removes owner actions without success', async ({ page }) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    const dialog = await openPrivacyDialog(page)
    fixture.identity.role = 'MANAGER'
    fixture.failures.set('grant', { status: 403, code: 'FORBIDDEN' })
    await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
    await expect(
      page.getByText('Изменить согласие может владелец организации.', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Дать согласие|Отозвать согласие|Скачать архив/ }),
    ).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Согласие выдано' })).toHaveCount(0)
    expect(fixture.writes('grant')).toHaveLength(1)
  } finally {
    fixture.dispose()
  }
})

test('R57 late export from old workspace does not download into the new one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fixture = await settingsPrivacyFixture(page, { multiTenant: true })
  try {
    await ready(page)
    fixture.hold('export')
    await page.getByTestId('export-organization').click()
    await expect.poll(() => fixture.writes('export').length).toBe(1)
    const downloads: string[] = []
    page.on('download', (file) => downloads.push(file.suggestedFilename()))
    await page
      .locator('select[aria-label="Рабочее пространство"]')
      .filter({ visible: true })
      .selectOption(PRIVACY_OTHER_TENANT)
    await expect(page).toHaveURL(/\/radar$/)
    await page.getByRole('link', { name: 'Настройки', exact: true }).click()
    await page
      .getByRole('navigation', { name: 'Разделы настроек' })
      .getByRole('link', { name: 'Данные', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Данные и конфиденциальность', exact: true }),
    ).toBeVisible()
    const response = page.waitForResponse((item) => item.url().endsWith('/organization/export'))
    fixture.release('export')
    await (await response).finished()
    await expect(page.getByTestId('export-organization-saved')).toHaveCount(0)
    expect(downloads).toEqual([])
    expect(fixture.writes('export')[0]!.tenant).toBe(TENANT_ID)
  } finally {
    fixture.dispose()
  }
})

for (const width of [1440, 1280, 1600, 834, 390, 320]) {
  test(`R57 reflow${width}: long names, keyboard dialog and ordinary axe`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
    try {
      await ready(page)
      await expect(
        page.getByRole('region', { name: 'Обучение моделей', exact: true }),
      ).toContainText(PRIVACY_LONG_NAME)
      await noOverflow(page)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      const dialog = await openPrivacyDialog(page)
      for (let step = 0; step < 5; step++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
      }
      const bounds = await dialog.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      if (width >= 1280) {
        expect(bounds!.width).toBe(640)
        expect(bounds!.height).toBe(640)
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      await noOverflow(page)
      await capture(page, testInfo, `reflow-${width}-dialog`)
      await page.keyboard.press('Escape')
      await expect(privacyDialog(page)).toHaveCount(0)
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

test('R57 confirmed grant returns focus while its reconciliation GET is pending', async ({
  page,
}) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    const dialog = await openPrivacyDialog(page, 'grant')
    fixture.hold('read')
    await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const group = page.getByRole('group', { name: 'Действия с согласием', exact: true })
    await expect(group).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Согласие выдано' })).toBeVisible()
    fixture.release('read')
    await expect(page.getByRole('button', { name: 'Отозвать согласие', exact: true })).toBeEnabled()
    expect(fixture.writes('grant')).toHaveLength(1)
  } finally {
    fixture.dispose()
  }
})

test('R57 one dialog and decision survive desktop/tablet/mobile resize', async ({ page }) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await ready(page)
    await openPrivacyDialog(page, 'grant')
    for (const width of [834, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(privacyDialog(page)).toHaveCount(1)
      await expect(privacyDialog(page)).toBeVisible()
      await expect(privacyDialog(page)).toContainText('90 до 365 дней')
      await noOverflow(page)
    }
    await page.keyboard.press('Escape')
    await expect(privacyDialog(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test.describe('R57 zoom reflow at 200% equivalent CSS viewport', () => {
  test.use({ viewport: { width: 720, height: 500 }, deviceScaleFactor: 2 })
  test('keeps content and consent actions reachable without horizontal document scrolling', async ({
    page,
  }, testInfo) => {
    const fixture = await settingsPrivacyFixture(page, { longNames: true })
    try {
      await ready(page)
      await noOverflow(page)
      await page.getByTestId('export-organization').scrollIntoViewIfNeeded()
      await expect(page.getByTestId('export-organization')).toBeVisible()
      const dialog = await openPrivacyDialog(page, 'grant')
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).scrollIntoViewIfNeeded()
      await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeVisible()
      await capture(page, testInfo, 'zoom-200-equivalent-dialog')
      await page.keyboard.press('Escape')
      await expect(privacyDialog(page)).toHaveCount(0)
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
})

test('R2 200: already active response preserves its existing-decision message on the page', async ({
  page,
}, info) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    fixture.responses.grantStatus = 200
    await ready(page)
    const dialog = await openPrivacyDialog(page, 'grant')
    await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    const notice = page.getByRole('status').filter({ hasText: 'Согласие уже действовало' })
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Повторная выдача ничего не изменила.')
    await capture(page, info, 'already-active-200')
    expect(fixture.writes('grant')).toHaveLength(1)
  } finally {
    fixture.dispose()
  }
})
for (const kind of ['grant', 'revoke'] as const)
  test(`R2 ${kind} retry remains available after mutation500 and reconcileGET500`, async ({
    page,
  }) => {
    const fixture = await settingsPrivacyFixture(page, {
      initial: kind === 'grant' ? 'never' : 'active',
    })
    try {
      await ready(page)
      const dialog = await openPrivacyDialog(page, kind)
      fixture.failures.set(kind, { status: 500, code: 'INTERNAL_ERROR' })
      fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
      await dialog
        .getByRole('button', { name: kind === 'grant' ? 'Дать согласие' : 'Отозвать', exact: true })
        .click()
      await expect(page.getByText('! Статус не обновлён', { exact: true })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Повторить', exact: true })).toBeEnabled()
      fixture.failures.delete(kind)
      fixture.failures.delete('read')
      await dialog.getByRole('button', { name: 'Повторить', exact: true }).click()
      await expect.poll(() => fixture.writes(kind).length).toBe(2)
      await expect(dialog).toHaveCount(0)
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: kind === 'grant' ? 'Согласие выдано' : 'Согласие отозвано' }),
      ).toBeVisible()
    } finally {
      fixture.dispose()
    }
  })

for (const kind of ['grant', 'revoke'] as const)
  for (const close of ['cancel', 'Escape'] as const)
    test(`R5 ${kind} ${close} after mutation500 and GET500 focuses status recovery`, async ({
      page,
    }) => {
      const fixture = await settingsPrivacyFixture(page, {
        initial: kind === 'grant' ? 'never' : 'active',
      })
      try {
        await ready(page)
        const dialog = await openPrivacyDialog(page, kind)
        fixture.failures.set(kind, { status: 500, code: 'INTERNAL_ERROR' })
        fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
        await dialog
          .getByRole('button', {
            name: kind === 'grant' ? 'Дать согласие' : 'Отозвать',
            exact: true,
          })
          .click()
        await expect(page.getByText('! Статус не обновлён', { exact: true })).toBeVisible()
        await expect(dialog.getByRole('button', { name: 'Повторить', exact: true })).toBeEnabled()
        if (close === 'cancel')
          await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        else await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        const recovery = page.getByRole('button', { name: 'Обновить статус', exact: true })
        await expect(recovery).toBeFocused()
        expect(fixture.writes(kind)).toHaveLength(1)
        fixture.failures.delete('read')
        await recovery.press('Enter')
        await expect(page.getByText('! Статус не обновлён', { exact: true })).toHaveCount(0)
        await expect(
          page.getByRole('button', {
            name: kind === 'grant' ? 'Дать согласие' : 'Отозвать согласие',
            exact: true,
          }),
        ).toBeEnabled()
        expect(fixture.writes(kind)).toHaveLength(1)
      } finally {
        fixture.dispose()
      }
    })
