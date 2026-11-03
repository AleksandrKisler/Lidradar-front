/** US-M14-01/02/04/07 mobile: layout and input evidence over the existing synthetic API. */
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  openPrivacyDialog,
  PRIVACY_LONG_NAME,
  privacyDialog,
  refreshPrivacy,
  settingsPrivacyFixture,
} from './fixtures/settings-privacy'

test.use({ viewport: { width: 390, height: 844 } })

const heading = (page: Page) =>
  page.getByRole('heading', { name: 'Данные и конфиденциальность', exact: true })
const navigation = (page: Page) => page.getByRole('navigation', { name: 'Разделы настроек' })
const mainStates = [
  'never',
  'active',
  'revoked',
  'loading',
  'load-error',
  'refresh-error',
  'readonly',
  'archive-preparing',
  'archive-saved',
  'archive-error',
  'archive-busy',
  'archive-limit',
  'grant-saved',
  'revoke-saved',
] as const
type MainState = (typeof mainStates)[number]

async function ready(page: Page, loading = false) {
  await page.goto('/settings/privacy')
  await expect(heading(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  if (!loading) await expect(page.getByTestId('consent-status')).not.toHaveText('Загружаем…')
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({
    path,
    fullPage: (await privacyDialog(page).count()) === 0,
    animations: 'disabled',
  })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function noOverflow(page: Page, modal = false) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    client: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    masks: [
      getComputedStyle(document.documentElement).overflowX,
      getComputedStyle(document.body).overflowX,
    ],
  }))
  expect(dimensions.width).toBe(page.viewportSize()!.width)
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.client)
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width)
  if (!modal)
    for (const overflow of dimensions.masks) expect(['hidden', 'clip']).not.toContain(overflow)
}

async function inside(target: Locator, container: Locator, vertical = true) {
  const inner = await target.boundingBox()
  const outer = await container.boundingBox()
  expect(inner).not.toBeNull()
  expect(outer).not.toBeNull()
  expect(inner!.x).toBeGreaterThanOrEqual(outer!.x - 0.5)
  expect(inner!.x + inner!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 0.5)
  if (vertical) {
    expect(inner!.y).toBeGreaterThanOrEqual(outer!.y - 0.5)
    expect(inner!.y + inner!.height).toBeLessThanOrEqual(outer!.y + outer!.height + 0.5)
  }
}

async function focusRing(page: Page) {
  const geometry = await page.locator(':focus').evaluate((element) => {
    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    const outset = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset))
    const scrollport = element.closest('.sheet-body')?.getBoundingClientRect()
    return {
      width: parseFloat(style.outlineWidth),
      style: style.outlineStyle,
      left: box.left - outset,
      right: box.right + outset,
      top: box.top - outset,
      bottom: box.bottom + outset,
      clipTop: scrollport?.top ?? 0,
      clipBottom: scrollport?.bottom ?? innerHeight,
    }
  })
  expect(geometry.width).toBeGreaterThan(0)
  expect(geometry.style).not.toBe('none')
  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.clipTop)
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.clipBottom)
}

async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

async function mainState(page: Page, state: MainState) {
  const fixture = await settingsPrivacyFixture(page, {
    initial: ['active', 'readonly', 'refresh-error', 'revoke-saved'].includes(state)
      ? 'active'
      : state === 'revoked'
        ? 'revoked'
        : 'never',
    manager: state === 'readonly',
  })
  if (state === 'loading') fixture.hold('read')
  if (state === 'load-error') fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
  await ready(page, state === 'loading')
  if (state === 'loading')
    await expect(page.getByText('Получаем состояние согласия…', { exact: true })).toBeVisible()
  if (state === 'load-error')
    await expect(page.getByRole('alert')).toContainText('Не удалось загрузить статус')
  if (state === 'refresh-error') {
    fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
    await refreshPrivacy(page)
    await expect(page.getByRole('alert')).toContainText('Статус не обновлён')
  }
  if (state === 'grant-saved' || state === 'revoke-saved') {
    const kind = state === 'grant-saved' ? 'grant' : 'revoke'
    const dialog = await openPrivacyDialog(page, kind)
    await dialog
      .getByRole('button', { name: kind === 'grant' ? 'Дать согласие' : 'Отозвать', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: kind === 'grant' ? 'Согласие выдано' : 'Согласие отозвано' }),
    ).toBeVisible()
  }
  if (state.startsWith('archive-')) {
    if (state === 'archive-preparing') fixture.hold('export')
    if (state === 'archive-error')
      fixture.failures.set('export', { status: 500, code: 'INTERNAL_ERROR' })
    if (state === 'archive-busy' || state === 'archive-limit')
      fixture.failures.set('export', {
        status: 429,
        code: state === 'archive-busy' ? 'EXPORT_BUSY' : 'RATE_LIMITED',
        retryAfter: state === 'archive-busy' ? '30' : '1080',
      })
    const download = state === 'archive-saved' ? page.waitForEvent('download') : null
    await page.getByTestId('export-organization').click()
    if (download) {
      await download
      await expect(page.getByTestId('export-organization-saved')).toBeVisible()
    } else if (state === 'archive-preparing')
      await expect(page.getByTestId('export-organization')).toHaveText('Готовим архив…')
    else await expect(page.getByTestId('export-organization-error')).toBeVisible()
  }
  return fixture
}

for (const state of mainStates) {
  test(`mobile390 ${state}: cards, feedback and actions stay inside their actual surfaces`, async ({
    page,
  }, info) => {
    const fixture = await mainState(page, state)
    try {
      const titleBox = await heading(page).boundingBox()
      expect(titleBox!.x).toBe(16)
      if (state === 'never') {
        expect(titleBox!.y).toBe(88)
        const appbar = page
          .locator('header')
          .filter({ has: page.getByRole('button', { name: 'Меню', exact: true }) })
        expect(await appbar.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 64 })
      }
      await expect(heading(page)).toHaveCSS('font-size', '20px')
      await expect(heading(page)).toHaveCSS('line-height', '28px')
      await expect(navigation(page).getByRole('link')).toHaveCount(6)
      await expect(page.getByLabel('Раздел настроек', { exact: true })).toHaveCount(0)
      await inside(
        navigation(page).getByRole('link', { name: 'Данные', exact: true }),
        navigation(page),
      )
      for (const section of await page.getByRole('main').locator('section').all()) {
        const box = await section.boundingBox()
        expect(box!.x).toBe(16)
        expect(box!.width).toBe(358)
        await expect(section).toHaveCSS('padding-left', '16px')
        await expect(section).toHaveCSS('border-radius', '18px')
        await expect(section.getByRole('heading')).toHaveCSS('font-size', '20px')
        await expect(section.getByRole('heading')).toHaveCSS('line-height', '28px')
        expect(await section.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        for (const control of await section.getByRole('button').all()) {
          await inside(control, section)
          expect((await control.boundingBox())!.height).toBe(46)
        }
      }
      for (const feedback of await page
        .locator('[role="alert"], [data-testid="export-organization-saved"]')
        .all()) {
        expect(await feedback.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      }
      const account = page.getByRole('link', { name: 'Открыть аккаунт →', exact: true })
      expect((await account.boundingBox())!.width).toBe(358)
      const legal = page.getByRole('region', { name: 'Документы', exact: true }).getByRole('link')
      const boxes = await Promise.all((await legal.all()).map((link) => link.boundingBox()))
      for (let index = 0; index < boxes.length; index++) {
        expect(boxes[index]!.height).toBeGreaterThanOrEqual(44)
        if (index > 0)
          expect(boxes[index]!.y).toBeGreaterThanOrEqual(
            boxes[index - 1]!.y + boxes[index - 1]!.height,
          )
      }
      if (state === 'active') {
        await expect(page.getByTestId('consent-audit')).toContainText('10:24')
        await expect(page.getByTestId('consent-audit')).not.toContainText(/\b(?:AM|PM)\b/)
      }
      await noOverflow(page)
      if (['never', 'load-error', 'readonly', 'archive-preparing', 'archive-limit'].includes(state))
        await axe(page)
      await capture(page, info, `mobile-main-${state}`)
    } finally {
      fixture.dispose()
    }
  })
}

for (const kind of ['grant', 'revoke'] as const) {
  for (const state of ['confirm', 'saving', 'error'] as const) {
    test(`mobile390 ${kind}-${state}: full viewport sheet, body and equal footer geometry`, async ({
      page,
    }, info) => {
      const fixture = await settingsPrivacyFixture(page, {
        initial: kind === 'grant' ? 'never' : 'active',
      })
      try {
        await ready(page)
        const dialog = await openPrivacyDialog(page, kind)
        if (state === 'saving') fixture.hold(kind)
        if (state === 'error') fixture.failures.set(kind, { status: 500, code: 'INTERNAL_ERROR' })
        if (state !== 'confirm') {
          await dialog
            .getByRole('button', {
              name: kind === 'grant' ? 'Дать согласие' : 'Отозвать',
              exact: true,
            })
            .click()
          if (state === 'saving')
            await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
          else await expect(dialog.getByRole('alert')).toBeVisible()
        }
        expect(await dialog.boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 })
        await expect(dialog).toHaveCSS('border-top-left-radius', '0px')
        const header = dialog.locator('header')
        const body = dialog.locator('.sheet-body')
        const footer = dialog.locator('footer')
        const titleBox = await dialog.getByRole('heading').boundingBox()
        expect(titleBox!.x).toBe(16)
        expect(titleBox!.y).toBe(16)
        await expect(dialog.getByRole('heading')).toHaveCSS('font-size', '20px')
        await expect(dialog.getByRole('heading')).toHaveCSS('line-height', '28px')
        const close = dialog.getByRole('button', { name: 'Закрыть', exact: true })
        expect(await close.boundingBox()).toMatchObject({ x: 328, y: 16, width: 46, height: 46 })
        await inside(header, dialog)
        await inside(body, dialog)
        await inside(footer, dialog)
        const paragraphs = body.locator('p')
        const firstParagraph = await paragraphs.nth(0).boundingBox()
        const secondParagraph = await paragraphs.nth(1).boundingBox()
        const bodyBox = await body.boundingBox()
        expect(firstParagraph!.x).toBe(16)
        expect(firstParagraph!.width).toBe(358)
        expect(firstParagraph!.y - bodyBox!.y).toBe(16)
        expect(secondParagraph!.y - firstParagraph!.y - firstParagraph!.height).toBe(20)
        const actions = footer.getByRole('button')
        await expect(actions).toHaveCount(2)
        const left = await actions.nth(0).boundingBox()
        const right = await actions.nth(1).boundingBox()
        expect(left).toMatchObject({ x: 16, width: 173, height: 46 })
        expect(right).toMatchObject({ x: 201, width: 173, height: 46 })
        expect(left!.y).toBe(right!.y)
        expect(left!.y + left!.height).toBe(828)
        expect(await body.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
        if (state === 'saving') {
          await expect(close).toBeDisabled()
          await page.keyboard.press('Escape')
          await expect(dialog).toBeVisible()
        }
        await noOverflow(page, true)
        await axe(page)
        await capture(page, info, `mobile-${kind}-${state}`)
      } finally {
        fixture.dispose()
      }
    })
  }
}

test('mobile width320/375/390/430: local 1000px strip and full-width actions reflow', async ({
  page,
}) => {
  const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
  try {
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 })
      await ready(page)
      const strip = navigation(page)
      expect(await strip.evaluate((node) => node.scrollWidth)).toBe(1000)
      const active = strip.getByRole('link', { name: 'Данные', exact: true })
      expect((await active.boundingBox())!.width).toBe(160)
      await inside(active, strip)
      if (width === 390) {
        expect(await strip.evaluate((node) => node.scrollLeft)).toBe(642)
        expect((await active.boundingBox())!.x).toBe(46)
      }
      for (const section of await page.getByRole('main').locator('section').all()) {
        expect((await section.boundingBox())!.width).toBe(width - 32)
        for (const button of await section.getByRole('button').all()) {
          const metrics = await button.evaluate((node) => {
            const box = node.getBoundingClientRect()
            const card = node.closest('section')!
            const style = getComputedStyle(card)
            return {
              width: box.width,
              available:
                card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            }
          })
          expect(metrics.width).toBe(metrics.available)
        }
      }
      await noOverflow(page)
    }
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('mobile767/tablet768/1023/desktop1024: correct shell and one shared consent model', async ({
  page,
}) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    await openPrivacyDialog(page)
    for (const width of [767, 768, 1023, 1024, 390]) {
      await page.setViewportSize({ width, height: 844 })
      const dialog = privacyDialog(page)
      await expect(dialog).toHaveCount(1)
      const box = await dialog.boundingBox()
      expect(box!.width).toBe(width < 768 ? width : 640)
      expect(box!.height).toBe(width < 768 ? 844 : 640)
      await noOverflow(page, true)
      expect(fixture.writes()).toEqual([])
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
    await expect(heading(page)).toHaveCSS('font-size', '20px')
    await expect(page.getByLabel('Раздел настроек', { exact: true })).toHaveCount(0)
  } finally {
    fixture.dispose()
  }
})

for (const viewport of [
  { width: 390, height: 390 },
  { width: 767, height: 390 },
]) {
  test(`mobile short${viewport.width}x${viewport.height}: scroll body, locked background and entire keyboard ring`, async ({
    page,
    browserName,
    isMobile,
  }, info) => {
    await page.setViewportSize(viewport)
    const fixture = await settingsPrivacyFixture(page, { longNames: true })
    try {
      await ready(page)
      const dialog = await openPrivacyDialog(page)
      const body = dialog.locator('.sheet-body')
      expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      const backgroundY = await page.evaluate(() => scrollY)
      const legal = body.getByRole('link')
      if (browserName === 'webkit' && isMobile) {
        await legal.focus()
        await page.keyboard.press('PageDown')
      } else {
        await body.hover()
        await page.mouse.wheel(0, 700)
      }
      await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
      expect(await page.evaluate(() => scrollY)).toBe(backgroundY)
      const close = dialog.getByRole('button', { name: 'Закрыть', exact: true })
      await close.focus()
      for (let step = 0; step < 4; step++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
        await focusRing(page)
      }
      await expect(close).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(dialog.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
      await focusRing(page)
      await noOverflow(page, true)
      await capture(page, info, `mobile-short-${viewport.width}`)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

for (const kind of ['grant', 'revoke'] as const) {
  test(`mobile ${kind}: pending model survives all breakpoints with one command and no close`, async ({
    page,
  }) => {
    const fixture = await settingsPrivacyFixture(page, {
      initial: kind === 'grant' ? 'never' : 'active',
    })
    fixture.hold(kind)
    try {
      await ready(page)
      const dialog = await openPrivacyDialog(page, kind)
      await dialog
        .getByRole('button', { name: kind === 'grant' ? 'Дать согласие' : 'Отозвать', exact: true })
        .click()
      await expect.poll(() => fixture.writes(kind).length).toBe(1)
      for (const width of [320, 767, 768, 1023, 1024, 390]) {
        await page.setViewportSize({ width, height: 844 })
        await expect(privacyDialog(page)).toHaveCount(1)
        await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
        await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled()
        await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
        await page.keyboard.press('Escape')
        await expect(dialog).toBeVisible()
        expect(fixture.writes(kind)).toHaveLength(1)
      }
      fixture.release(kind)
      await expect(dialog).toHaveCount(0)
      expect(fixture.writes(kind)).toHaveLength(1)
    } finally {
      fixture.dispose()
    }
  })
}

test('mobile long actor/organization/trace/filename: no surface clipping and real size text', async ({
  page,
}, info) => {
  const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
  fixture.archive.filename = `organization-${'long-export-name-'.repeat(5)}2026-11-02.zip`
  try {
    await ready(page)
    await expect(page.getByTestId('consent-audit')).toContainText(PRIVACY_LONG_NAME)
    await expect(page.getByTestId('consent-audit')).toContainText('11:45')
    await expect(page.getByTestId('consent-audit')).not.toContainText(/\b(?:AM|PM)\b/)
    const download = page.waitForEvent('download')
    await page.getByTestId('export-organization').click()
    await download
    const saved = page.getByTestId('export-organization-saved')
    await expect(saved).toContainText(fixture.archive.filename)
    await expect(saved).toContainText('22')
    expect(await saved.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    const dialog = await openPrivacyDialog(page)
    fixture.failures.set('grant', {
      status: 500,
      code: 'INTERNAL_ERROR',
      traceId: `mobile-fixture-${'trace'.repeat(28)}`,
    })
    await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
    const alert = dialog.getByRole('alert')
    await expect(alert).toBeVisible()
    expect(await alert.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    await inside(alert, dialog, false)
    await noOverflow(page, true)
    await axe(page)
    await capture(page, info, 'mobile-long-error')
  } finally {
    fixture.dispose()
  }
})

test('mobile keyboard links: four actual legal popups, then Account, without hover or writes', async ({
  page,
  browserName,
}) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    const links = page.getByRole('region', { name: 'Документы', exact: true }).getByRole('link')
    const titles = [
      'Пользовательское соглашение',
      'Приложение № 1. Поручение на обработку персональных данных',
      'Политика обработки персональных данных',
      'Приложение № 2. Использование данных для улучшения AI',
    ]
    await links.first().focus()
    for (let index = 0; index < 4; index++) {
      const link = links.nth(index)
      await expect(link).toBeFocused()
      const popupPromise = page.waitForEvent('popup')
      await page.keyboard.press('Enter')
      const popup = await popupPromise
      try {
        await popup.waitForLoadState('domcontentloaded')
        expect((await popup.request.get(popup.url())).status()).toBe(200)
        await expect(
          popup.getByRole('heading', { name: titles[index]!, level: 1, exact: true }),
        ).toBeVisible()
      } finally {
        await popup.close()
      }
      await page.bringToFront()
      await link.focus()
      await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
    }
    const account = page.getByRole('link', { name: 'Открыть аккаунт →', exact: true })
    await expect(account).toBeFocused()
    await expect(account).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings\/account$/)
    await expect(page.getByRole('heading', { name: 'Мои данные', exact: true })).toBeVisible()
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('mobile local tabs: Home/End/arrows show entire focused control and Enter/back keeps Data visible', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    await navigation(page).getByRole('link', { name: 'Данные', exact: true }).focus()
    for (const [key, name] of [
      ['Home', 'Компания и график'],
      ['ArrowRight', 'Услуги'],
      ['End', 'Аккаунт'],
      ['ArrowLeft', 'Данные'],
      ['ArrowRight', 'Аккаунт'],
    ]) {
      await page.keyboard.press(key!)
      const current = navigation(page).getByRole('link', { name: name!, exact: true })
      await expect(current).toBeFocused()
      await inside(current, navigation(page))
    }
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings\/account$/)
    await page.goBack()
    await expect(
      navigation(page).getByRole('link', { name: 'Данные', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    await inside(
      navigation(page).getByRole('link', { name: 'Данные', exact: true }),
      navigation(page),
    )
    await noOverflow(page)
    expect(errors).toEqual([])
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

for (const kind of ['grant', 'revoke'] as const) {
  for (const close of ['Escape', 'Cancel'] as const) {
    test(`mobile rotation ${kind} ${close}: error recovery focus and its full ring remain visible`, async ({
      page,
    }, info) => {
      const fixture = await settingsPrivacyFixture(page, {
        initial: kind === 'grant' ? 'revoked' : 'active',
        longNames: true,
      })
      try {
        await page.setViewportSize({ width: 390, height: 844 })
        await ready(page)
        const dialog = await openPrivacyDialog(page, kind)
        await page.setViewportSize({ width: 667, height: 375 })
        await expect(dialog).toHaveCSS('height', '375px')
        await expect
          .poll(() => page.evaluate(() => visualViewport?.height ?? innerHeight))
          .toBe(375)
        fixture.failures.set(kind, { status: 500, code: 'INTERNAL_ERROR', traceId: '' })
        fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR', traceId: '' })
        await dialog
          .getByRole('button', {
            name: kind === 'grant' ? 'Дать согласие' : 'Отозвать',
            exact: true,
          })
          .click()
        await expect(dialog.getByRole('alert')).toBeVisible()
        const recovery = page.locator('#consent-refresh')
        await expect(recovery).toBeEnabled()
        if (close === 'Escape') await page.keyboard.press('Escape')
        else {
          await dialog.getByRole('button', { name: 'Отмена', exact: true }).focus()
          await page.keyboard.press('Enter')
        }
        await expect(dialog).toHaveCount(0)
        await expect(recovery).toBeFocused()
        await expect(recovery).toBeInViewport({ ratio: 1 })
        await focusRing(page)
        await noOverflow(page)
        expect(fixture.writes(kind)).toHaveLength(1)
        const focusPath = info.outputPath(`rotation-${kind}-${close}-visible-focus.png`)
        await page.screenshot({ path: focusPath, fullPage: false, animations: 'disabled' })
        await info.attach('rotation-visible-recovery-focus', {
          path: focusPath,
          contentType: 'image/png',
        })
        const reads = fixture.calls.filter((call) => call.endpoint === 'read').length
        fixture.failures.delete('read')
        await page.keyboard.press('Enter')
        await expect
          .poll(() => fixture.calls.filter((call) => call.endpoint === 'read').length)
          .toBeGreaterThan(reads)
        await expect(recovery).toHaveCount(0)
        expect(fixture.writes(kind)).toHaveLength(1)
        await capture(page, info, `rotation-${kind}-${close}-recovered`)
      } finally {
        fixture.dispose()
      }
    })
  }
}

test.describe('mobile touch and reduced motion', () => {
  test.use({ hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  test('visible Data and consent controls work by touch without hover', async ({ page }) => {
    const fixture = await settingsPrivacyFixture(page)
    try {
      await ready(page)
      await navigation(page).getByRole('link', { name: 'Данные', exact: true }).tap()
      await page.getByRole('button', { name: 'Дать согласие', exact: true }).tap()
      const dialog = privacyDialog(page)
      await expect(dialog).toBeVisible()
      expect(
        await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
      ).toBe(true)
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await noOverflow(page)
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
  test('Chromium native synthetic mobile drag stays local and does not activate a link', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Native synthetic drag uses CDP; WebKit/mobile native taps have separate coverage.',
    )
    const fixture = await settingsPrivacyFixture(page)
    try {
      await ready(page)
      const strip = navigation(page)
      const before = await strip.evaluate((node) => node.scrollLeft)
      const box = await strip.boundingBox()
      const session = await page.context().newCDPSession(page)
      try {
        const x = box!.x + 40,
          y = box!.y + box!.height / 2
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        })
        for (let step = 1; step <= 7; step++)
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + step * 35, y }],
          })
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await expect
          .poll(() => strip.evaluate((node) => node.scrollLeft))
          .toBeLessThan(before - 100)
        await expect(page).toHaveURL(/\/settings\/privacy$/)
        await noOverflow(page)
        expect(fixture.writes()).toEqual([])
      } finally {
        await session.detach()
      }
    } finally {
      fixture.dispose()
    }
  })
})

test('mobile 200% text: long content and equal actions remain reachable without hiding overflow', async ({
  page,
}, info) => {
  const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
  try {
    await ready(page)
    // Relative text enlargement is separate from native browser zoom and CSS viewport reflow.
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await expect(
      page.getByRole('region', { name: 'Обучение моделей', exact: true }).locator('p').first(),
    ).toHaveCSS('font-size', '28px')
    await noOverflow(page)
    const dialog = await openPrivacyDialog(page)
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
      await expect(page.locator(':focus')).toBeInViewport()
    }
    await noOverflow(page, true)
    await axe(page)
    await capture(page, info, 'mobile-200-text')
    await page.keyboard.press('Escape')
  } finally {
    fixture.dispose()
  }
})

test.describe('mobile320 CSS reflow with DSF2, not native browser zoom', () => {
  test.use({ viewport: { width: 320, height: 422 }, deviceScaleFactor: 2 })
  test('readable flow and keyboard dialog actions at the supported minimum width', async ({
    page,
  }, info) => {
    const fixture = await settingsPrivacyFixture(page, { longNames: true })
    try {
      await ready(page)
      await noOverflow(page)
      const dialog = await openPrivacyDialog(page)
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).focus()
      await expect(page.locator(':focus')).toBeInViewport()
      await noOverflow(page, true)
      await capture(page, info, 'mobile-200-equivalent')
      await page.keyboard.press('Escape')
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
})

test('Chromium native mobile pinch: visual scale, focus and cancellation remain reachable', async ({
  playwright,
  browserName,
}, info) => {
  test.skip(
    browserName !== 'chromium',
    'Native synthetic pinch uses Chromium CDP; this is not cross-engine or toolbar zoom evidence.',
  )
  // Exercise native touch pinch in full Chrome rather than Linux's reduced headless-shell.
  // https://playwright.dev/docs/browsers#chromium-new-headless-mode
  const pinchBrowser = await playwright.chromium.launch({ channel: 'chromium' })
  const context = await pinchBrowser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  const fixture = await settingsPrivacyFixture(page)
  const session = await context.newCDPSession(page)
  try {
    await ready(page)
    // Retain native input evidence even when the compositor does not change scale in CI.
    // These passive observers neither synthesize input nor alter the page's zoom policy.
    const inputs = await page.evaluateHandle(() => {
      const events: {
        type: string
        trusted: boolean
        prevented: boolean
        touches: { x: number; y: number }[]
        scale: number
      }[] = []
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const)
        document.addEventListener(
          type,
          (event) => {
            const value = {
              type,
              trusted: event.isTrusted,
              prevented: event.defaultPrevented,
              touches: Array.from(event.touches, (touch) => ({
                x: touch.clientX,
                y: touch.clientY,
              })),
              scale: visualViewport?.scale ?? 1,
            }
            events.push(value)
            queueMicrotask(() => (value.prevented = event.defaultPrevented))
          },
          { capture: true, passive: true },
        )
      return events
    })
    const beforeGesture = await session.send('Page.getLayoutMetrics')
    const featureSwitches = (await session.send('Browser.getBrowserCommandLine')).arguments.filter(
      (argument) => /^--(?:enable|disable)-features=/.test(argument),
    )
    // Chromium 153 defaults SyntheticPointerActions to OFF. Its ordinary CDP touch
    // injector uses TouchEmulator/FilteredGestureProvider, including native pinch
    // recognition. Aura's synthetic pinch bypasses that dispatcher: CI delivered
    // two trusted contacts but never changed page scale. Keep browser zoom native.
    expect(
      featureSwitches.filter((argument) => argument.startsWith('--enable-features=')).join(','),
    ).not.toMatch(/(?:=|,)SyntheticPointerActions(?:[<:,]|$)/)
    const touches = async (halfSpan: number) => {
      // CDP converts CSS input coordinates by the current page scale. Keep the
      // physical fingers moving apart in the viewport as native zoom progresses.
      const scale = await page.evaluate(() => visualViewport?.scale ?? 1)
      return [
        { id: 0, x: 195 / scale, y: (422 - halfSpan) / scale },
        { id: 1, x: 195 / scale, y: (422 + halfSpan) / scale },
      ]
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: await touches(128),
    })
    try {
      for (let frame = 1; frame <= 12; frame++) {
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        )
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: await touches(128 + (128 * frame) / 12),
        })
      }
    } finally {
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const delivered = await inputs.jsonValue()
    await info.attach('native-pinch-input-delivery', {
      body: JSON.stringify({
        browser: await session.send('Browser.getVersion'),
        featureSwitches,
        inputMethod: 'Input.dispatchTouchEvent; two physical contacts, browser-native recognition',
        beforeGesture,
        afterGesture: await session.send('Page.getLayoutMetrics'),
        maxTouchPoints: await page.evaluate(() => navigator.maxTouchPoints),
        events: delivered,
      }),
      contentType: 'application/json',
    })
    expect(delivered.some((event) => event.touches.length === 2)).toBe(true)
    expect(delivered.every((event) => event.trusted && !event.prevented)).toBe(true)
    await expect.poll(() => page.evaluate(() => visualViewport?.scale ?? 1)).toBeGreaterThan(1.5)
    await noOverflow(page)
    const trigger = page.getByRole('button', { name: 'Дать согласие', exact: true })
    await trigger.focus()
    await expect(trigger).toBeFocused()
    expect(
      await trigger.evaluate((node) => {
        const box = node.getBoundingClientRect(),
          view = visualViewport!
        return (
          box.right > view.offsetLeft &&
          box.left < view.offsetLeft + view.width &&
          box.bottom > view.offsetTop &&
          box.top < view.offsetTop + view.height
        )
      }),
    ).toBe(true)
    await page.keyboard.press('Enter')
    const dialog = privacyDialog(page)
    await expect(dialog).toBeVisible()
    const close = dialog.getByRole('button', { name: 'Закрыть', exact: true })
    await expect(close).toBeFocused()
    // Genuine keyboard navigation pans the native visual viewport; programmatic focus does not.
    await page.keyboard.press('Shift+Tab')
    await expect(
      dialog.locator('footer').getByRole('button', { name: 'Дать согласие', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    const readFocus = () =>
      close.evaluate((node) => {
        const box = node.getBoundingClientRect(),
          view = visualViewport!
        const style = getComputedStyle(node)
        const outset = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset))
        return {
          scale: view.scale,
          left: box.left - outset,
          right: box.right + outset,
          top: box.top - outset,
          bottom: box.bottom + outset,
          visualLeft: view.offsetLeft,
          visualRight: view.offsetLeft + view.width,
          visualTop: view.offsetTop,
          visualBottom: view.offsetTop + view.height,
        }
      })
    await expect
      .poll(async () => {
        const value = await readFocus()
        return (
          value.scale > 1.5 &&
          value.left >= value.visualLeft &&
          value.right <= value.visualRight &&
          value.top >= value.visualTop &&
          value.bottom <= value.visualBottom
        )
      })
      .toBe(true)
    const focus = await readFocus()
    await info.attach('native-pinch-visual-focus', {
      body: JSON.stringify(focus, null, 2),
      contentType: 'application/json',
    })
    expect(focus.scale).toBeGreaterThan(1.5)
    expect(focus.left).toBeGreaterThanOrEqual(focus.visualLeft)
    expect(focus.right).toBeLessThanOrEqual(focus.visualRight)
    expect(focus.top).toBeGreaterThanOrEqual(focus.visualTop)
    expect(focus.bottom).toBeLessThanOrEqual(focus.visualBottom)
    await noOverflow(page, true)
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(fixture.writes()).toEqual([])
  } finally {
    const path = info.outputPath('native-pinch.png')
    await page
      .screenshot({ path, animations: 'disabled' })
      .then(() => info.attach('native-pinch', { path, contentType: 'image/png' }))
      .catch(() => undefined)
    fixture.dispose()
    await session.detach()
    await context.close()
    await pinchBrowser.close()
  }
})

for (const width of [390, 1280]) {
  for (const kind of ['grant', 'revoke'] as const) {
    test(`shared consent background read ${kind}${width}: confirmation availability follows its guard`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 720 })
      const fixture = await settingsPrivacyFixture(page, {
        initial: kind === 'grant' ? 'never' : 'active',
      })
      try {
        await ready(page)
        const dialog = await openPrivacyDialog(page, kind)
        const confirmation = dialog.getByRole('button', {
          name: kind === 'grant' ? 'Дать согласие' : 'Отозвать',
          exact: true,
        })
        await expect(confirmation).toBeEnabled()
        const reads = fixture.calls.filter((call) => call.endpoint === 'read').length
        fixture.hold('read')
        await refreshPrivacy(page)
        await expect
          .poll(() => fixture.calls.filter((call) => call.endpoint === 'read').length)
          .toBeGreaterThan(reads)
        // A background refresh blocks the command even though the dialog remains open.
        // Its primary action must express that guard rather than silently drop a click.
        await expect(confirmation).toBeDisabled()
        await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeEnabled()
        await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeEnabled()
        expect(fixture.writes()).toEqual([])
        fixture.release('read')
        await expect(confirmation).toBeEnabled()
        await confirmation.click()
        await expect(dialog).toHaveCount(0)
        expect(fixture.writes(kind)).toHaveLength(1)
        expect(fixture.writes(kind)[0]!.method).toBe(kind === 'grant' ? 'POST' : 'DELETE')
        await expect(page.getByTestId('consent-status')).toHaveText(
          kind === 'grant' ? '✓ Действует' : 'Не дано',
        )
      } finally {
        fixture.dispose()
      }
    })
  }
}
