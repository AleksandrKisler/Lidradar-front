/** US-M14-01/02/04/07: tablet geometry and interactions, using synthetic API fixtures. */
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  openPrivacyDialog,
  PRIVACY_LONG_NAME,
  privacyDialog,
  settingsPrivacyFixture,
} from './fixtures/settings-privacy'

const title = 'Данные и конфиденциальность'
const tabs = (page: Page) => page.getByRole('navigation', { name: 'Разделы настроек' })

async function ready(page: Page) {
  await page.goto('/settings/privacy')
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.getByTestId('consent-status')).not.toHaveText('Загружаем…')
  await page.evaluate(() => document.fonts.ready)
}

async function noDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(dimensions.width).toBe(page.viewportSize()!.width)
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.width)
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width)
}

async function fullyInside(target: Locator, container: Locator) {
  const outer = await container.boundingBox()
  const inner = await target.boundingBox()
  expect(outer).not.toBeNull()
  expect(inner).not.toBeNull()
  expect(inner!.x).toBeGreaterThanOrEqual(outer!.x - 1)
  expect(inner!.x + inner!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1)
  expect(inner!.y).toBeGreaterThanOrEqual(outer!.y - 1)
  expect(inner!.y + inner!.height).toBeLessThanOrEqual(outer!.y + outer!.height + 1)
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function axe(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('tablet loading: approved fixed bars clip at the viewport without document overflow', async ({
  page,
}) => {
  const fixture = await settingsPrivacyFixture(page)
  fixture.hold('read')
  try {
    await page.setViewportSize({ width: 834, height: 1194 })
    await page.goto('/settings/privacy')
    await expect(page.getByText('Получаем состояние согласия…', { exact: true })).toBeVisible()
    const frame = page
      .getByRole('region', { name: 'Обучение моделей', exact: true })
      .locator(':scope > div[aria-hidden="true"]')
    const bars = frame.locator(':scope > div')
    await expect(frame).toHaveCount(1)
    await expect(bars).toHaveCount(2)
    for (const width of [768, 834, 1023, 1440, 390]) {
      await page.setViewportSize({ width, height: 1194 })
      await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCSS(
        'font-size',
        width < 768 ? '20px' : '32px',
      )
      await expect
        .poll(() => bars.first().evaluate((node) => (node as HTMLElement).style.width))
        .toBe(width >= 768 && width < 1024 ? '857.6px' : '80%')
      const geometry = await frame.evaluate((parent) => {
        const nodes = [...parent.children]
        const frame = parent.getBoundingClientRect()
        return {
          frame: { x: frame.x, right: frame.right, width: frame.width },
          widths: nodes.map((node) => node.getBoundingClientRect().width),
          overflow: getComputedStyle(parent).overflowX,
        }
      })
      if (width >= 768 && width < 1024) {
        // Figma1499:25594 uses857.6/643.2; DOM CSS sizes are quantized to1/64px.
        expect(geometry.widths[0]).toBeCloseTo(857.6, 1)
        expect(geometry.widths[1]).toBeCloseTo(643.2, 1)
        expect(geometry.frame.x).toBe(49)
        expect(geometry.frame.right).toBe(width)
        expect(geometry.overflow).toBe('hidden')
      } else {
        expect(geometry.widths[0]).toBeCloseTo(geometry.frame.width * 0.8, 1)
        expect(geometry.widths[1]).toBeCloseTo(geometry.frame.width * 0.6, 1)
      }
      await noDocumentOverflow(page)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true)
    }
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

for (const width of [768, 834, 1023]) {
  test(`tablet ${width}: approved content geometry and local six-section scroll`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1194 })
    const fixture = await settingsPrivacyFixture(page)
    try {
      await ready(page)
      const heading = page.getByRole('heading', { name: title, exact: true })
      const consent = page.getByRole('region', { name: 'Обучение моделей', exact: true })
      const headingBox = await heading.boundingBox()
      const cardBox = await consent.boundingBox()
      expect(headingBox!.x).toBe(24)
      expect(headingBox!.y).toBe(96)
      expect(cardBox!.x).toBe(24)
      expect(cardBox!.width).toBe(width - 48)
      expect(
        await heading.evaluate((node) => {
          const style = getComputedStyle(node)
          return [style.fontSize, style.lineHeight]
        }),
      ).toEqual(['32px', '40px'])
      expect(
        await consent.getByRole('heading').evaluate((node) => {
          const style = getComputedStyle(node)
          return [style.fontSize, style.lineHeight]
        }),
      ).toEqual(['20px', '28px'])
      const cardHeading = await consent.getByRole('heading').boundingBox()
      // The card's one-pixel border is outside its 24px content padding.
      expect(cardHeading!.x - cardBox!.x).toBe(25)
      const navigation = tabs(page)
      await expect(navigation).toBeVisible()
      await expect(navigation.getByRole('link')).toHaveCount(6)
      await expect(page.getByLabel('Раздел настроек', { exact: true })).toHaveCount(0)
      expect(await navigation.evaluate((node) => node.scrollWidth)).toBe(1120)
      expect((await navigation.boundingBox())!.height).toBe(46)
      await fullyInside(navigation.getByRole('link', { name: 'Данные', exact: true }), navigation)
      if (width === 834) {
        expect(await navigation.evaluate((node) => node.scrollLeft)).toBe(334)
        await axe(page)
        await capture(page, info, 'tablet-834-main-geometry')
      }
      await noDocumentOverflow(page)
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

test('tablet 834: Home/End/arrows reveal focused tabs; Enter and mouse navigate', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 834, height: 1194 })
  const fixture = await settingsPrivacyFixture(page)
  try {
    await ready(page)
    const navigation = tabs(page)
    await navigation.getByRole('link', { name: 'Данные', exact: true }).focus()
    for (const [key, name] of [
      ['Home', 'Компания и график'],
      ['ArrowRight', 'Услуги'],
      ['End', 'Аккаунт'],
      ['ArrowLeft', 'Данные'],
      ['ArrowRight', 'Аккаунт'],
    ]) {
      await page.keyboard.press(key!)
      const focused = navigation.getByRole('link', { name: name!, exact: true })
      await expect(focused).toBeFocused()
      await fullyInside(focused, navigation)
      await expect(page).toHaveURL(/\/settings\/privacy$/)
    }
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings\/account$/)
    await page.goBack()
    await expect(navigation.getByRole('link', { name: 'Данные', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await fullyInside(navigation.getByRole('link', { name: 'Данные', exact: true }), navigation)
    await navigation.getByRole('link', { name: 'Уведомления', exact: true }).click()
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(page.getByRole('heading', { name: 'Уведомления', exact: true })).toBeVisible()
    expect(pageErrors).toEqual([])
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('tablet manager: disabled sections remain explained and are skipped by keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 834, height: 1194 })
  const fixture = await settingsPrivacyFixture(page, { manager: true, initial: 'active' })
  try {
    await ready(page)
    const navigation = tabs(page)
    for (const name of ['Компания и график', 'Услуги', 'Команда']) {
      const disabled = navigation.getByRole('link', { name, exact: true })
      await expect(disabled).toHaveAttribute('aria-disabled', 'true')
      await expect(disabled).toHaveAttribute('title', 'Раздел недоступен в текущей роли')
      await expect(disabled).not.toHaveAttribute('href')
    }
    await navigation.getByRole('link', { name: 'Данные', exact: true }).focus()
    await page.keyboard.press('Home')
    await expect(navigation.getByRole('link', { name: 'Уведомления', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(navigation.getByRole('link', { name: 'Аккаунт', exact: true })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(navigation.getByRole('link', { name: 'Уведомления', exact: true })).toBeFocused()
    await noDocumentOverflow(page)
    await axe(page)
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('767/768 and 1023/1024: correct navigation and dialog at each breakpoint', async ({
  page,
}) => {
  const fixture = await settingsPrivacyFixture(page)
  try {
    for (const width of [767, 768, 1023, 1024]) {
      await page.setViewportSize({ width, height: 1194 })
      await ready(page)
      await expect(tabs(page)).toBeVisible()
      if (width < 1024)
        await expect(page.getByLabel('Раздел настроек', { exact: true })).toHaveCount(0)
      else await expect(page.getByLabel('Раздел настроек', { exact: true })).toBeHidden()
      await fullyInside(tabs(page).getByRole('link', { name: 'Данные', exact: true }), tabs(page))
      const dialog = await openPrivacyDialog(page)
      await expect(privacyDialog(page)).toHaveCount(1)
      const box = await dialog.boundingBox()
      if (width >= 768) {
        expect(box!.width).toBe(640)
        expect(box!.height).toBe(640)
        expect(box!.x).toBe((width - 640) / 2)
        expect(box!.y).toBe((1194 - 640) / 2)
      } else {
        expect(box).toMatchObject({ x: 0, y: 0, width, height: 1194 })
      }
      await noDocumentOverflow(page)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
    }
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

for (const kind of ['grant', 'revoke'] as const) {
  test(`tablet ${kind}: 640 sheet, equal footer actions, complete keyboard trap and return`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 834, height: 1194 })
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
      expect(await dialog.boundingBox()).toMatchObject({ x: 97, y: 277, width: 640, height: 640 })
      const footer = dialog.locator('footer')
      const cancel = footer.getByRole('button', { name: 'Отмена', exact: true })
      const command = footer.getByRole('button', {
        name: kind === 'grant' ? 'Дать согласие' : 'Отозвать',
        exact: true,
      })
      const cancelBox = await cancel.boundingBox()
      const commandBox = await command.boundingBox()
      expect(cancelBox!.height).toBe(46)
      expect(commandBox!.height).toBe(46)
      expect(cancelBox!.width).toBe(289)
      expect(commandBox!.width).toBe(289)
      expect(cancelBox!.width).toBe(commandBox!.width)
      expect(commandBox!.x - cancelBox!.x - cancelBox!.width).toBe(12)
      await fullyInside(cancel, dialog)
      await fullyInside(command, dialog)
      await dialog.evaluate((node) => node.setAttribute('data-footer-resize-probe', 'same-dialog'))
      for (const width of [1440, 834]) {
        await page.setViewportSize({ width, height: 1194 })
        await expect(privacyDialog(page)).toHaveCount(1)
        await expect(dialog).toHaveAttribute('data-footer-resize-probe', 'same-dialog')
        expect(await dialog.boundingBox()).toMatchObject({
          x: (width - 640) / 2,
          y: 277,
          width: 640,
          height: 640,
        })
        expect((await cancel.boundingBox())!.width).toBe(289)
        expect((await command.boundingBox())!.width).toBe(289)
        expect(fixture.writes()).toEqual([])
      }
      const close = dialog.getByRole('button', { name: 'Закрыть', exact: true })
      await close.focus()
      for (let step = 0; step < (kind === 'grant' ? 4 : 3); step++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
      }
      await expect(close).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(command).toBeFocused()
      await axe(page)
      await capture(page, info, `tablet-${kind}-dialog`)
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
      await openPrivacyDialog(page, kind)
      await cancel.click()
      await expect(trigger).toBeFocused()
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })

  test(`tablet ${kind}: pending survives resize and rejects close or duplicate commands`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 834, height: 1194 })
    const fixture = await settingsPrivacyFixture(page, {
      initial: kind === 'grant' ? 'never' : 'active',
    })
    fixture.hold(kind)
    try {
      await ready(page)
      const dialog = await openPrivacyDialog(page, kind)
      const commandName = kind === 'grant' ? 'Дать согласие' : 'Отозвать'
      await dialog.getByRole('button', { name: commandName, exact: true }).click()
      await expect.poll(() => fixture.writes(kind).length).toBe(1)
      // A property on the actual node distinguishes one persistent tablet/desktop sheet from remounts.
      await dialog.evaluate((node) => node.setAttribute('data-tablet-persistence-probe', 'pending'))
      for (const width of [1023, 1024, 768]) {
        await page.setViewportSize({ width, height: 1000 })
        await expect(privacyDialog(page)).toHaveCount(1)
        await expect(dialog).toHaveAttribute('data-tablet-persistence-probe', 'pending')
        await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
        await expect(dialog.getByRole('button', { name: 'Закрыть', exact: true })).toBeDisabled()
        await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
        await page.keyboard.press('Escape')
        await page.mouse.click(2, 2)
        await expect(dialog).toBeVisible()
        expect(fixture.writes(kind)).toHaveLength(1)
      }
      for (const width of [767, 834]) {
        await page.setViewportSize({ width, height: 1000 })
        await expect(privacyDialog(page)).toHaveCount(1)
        await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
        await page.keyboard.press('Escape')
        await expect(dialog).toBeVisible()
        expect(fixture.writes(kind)).toHaveLength(1)
      }
      await axe(page)
      fixture.release(kind)
      await expect(dialog).toHaveCount(0)
      await expect(
        page.getByRole('button', {
          name: kind === 'grant' ? 'Отозвать согласие' : 'Дать согласие',
          exact: true,
        }),
      ).toBeEnabled()
      expect(fixture.writes(kind)).toHaveLength(1)
    } finally {
      fixture.dispose()
    }
  })
}

for (const viewport of [
  { width: 1023, height: 600 },
  { width: 834, height: 480 },
]) {
  test(`tablet landscape ${viewport.width}x${viewport.height}: body scroll, footer and unclipped keyboard focus`, async ({
    page,
    browserName,
    isMobile,
  }, info) => {
    await page.setViewportSize(viewport)
    const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
    try {
      await ready(page)
      await expect(page.getByTestId('consent-audit')).toContainText(PRIVACY_LONG_NAME)
      await noDocumentOverflow(page)
      const dialog = await openPrivacyDialog(page)
      if (viewport.height === 600) {
        // The ordinary text fits at 600px. A real command error creates the long body to scroll.
        fixture.failures.set('grant', { status: 500, code: 'INTERNAL_ERROR' })
        await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
        await expect(dialog.getByRole('alert')).toBeVisible()
      }
      const body = dialog.locator('.sheet-body')
      expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      const legal = body.getByRole('link')
      if (browserName === 'webkit' && isMobile) {
        // Playwright mobile WebKit rejects mouse.wheel; exercise native keyboard scrolling.
        await legal.focus()
        await page.keyboard.press('PageDown')
      } else {
        await body.hover()
        await page.mouse.wheel(0, 600)
      }
      await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).focus()
      await legal.focus()
      await fullyInside(legal, body)
      const footer = dialog.locator('footer')
      await fullyInside(footer, dialog)
      await page.keyboard.press('Tab')
      await expect(footer.getByRole('button', { name: 'Отмена', exact: true })).toBeFocused()
      const focus = await page.locator(':focus').evaluate((node) => {
        const box = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
        return {
          top: box.top - ring,
          bottom: box.bottom + ring,
          left: box.left - ring,
          right: box.right + ring,
          width: parseFloat(style.outlineWidth),
          style: style.outlineStyle,
        }
      })
      expect(focus.width).toBeGreaterThan(0)
      expect(focus.style).not.toBe('none')
      expect(focus.top).toBeGreaterThanOrEqual(0)
      expect(focus.bottom).toBeLessThanOrEqual(viewport.height)
      expect(focus.left).toBeGreaterThanOrEqual(0)
      expect(focus.right).toBeLessThanOrEqual(viewport.width)
      await page.keyboard.press('Tab')
      await expect(
        footer.getByRole('button', {
          name: viewport.height === 600 ? 'Повторить' : 'Дать согласие',
          exact: true,
        }),
      ).toBeFocused()
      await fullyInside(page.locator(':focus'), dialog)
      await noDocumentOverflow(page)
      await capture(page, info, `landscape-${viewport.width}x${viewport.height}`)
      await page.keyboard.press('Escape')
      expect(fixture.writes('grant')).toHaveLength(viewport.height === 600 ? 1 : 0)
      expect(fixture.writes('revoke')).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
}

test('tablet: all four legal targets are reachable by keyboard and open real documents', async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 834, height: 1194 })
  const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
  try {
    await ready(page)
    const links = page.getByRole('region', { name: 'Документы', exact: true }).getByRole('link')
    await expect(links).toHaveCount(4)
    const documentTitles = [
      'Пользовательское соглашение',
      'Приложение № 1. Поручение на обработку персональных данных',
      'Политика обработки персональных данных',
      'Приложение № 2. Использование данных для улучшения AI',
    ]
    await links.first().focus()
    for (let index = 0; index < 4; index++) {
      const link = links.nth(index)
      await expect(link).toBeFocused()
      const box = await link.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      const popupPromise = page.waitForEvent('popup')
      await page.keyboard.press('Enter')
      const popup = await popupPromise
      try {
        const response = await popup
          .waitForLoadState('domcontentloaded')
          .then(() => popup.request.get(popup.url()))
        expect(response.status()).toBe(200)
        expect(popup.url()).toMatch(/\/legal\/(terms|dpa|privacy|ai-data)\.html$/)
        await expect(
          popup.getByRole('heading', { level: 1, name: documentTitles[index]!, exact: true }),
        ).toBeVisible()
      } finally {
        await popup.close()
      }
      await page.bringToFront()
      await link.focus()
      await expect(link).toBeFocused()
      // Safari's native full link navigation uses Option+Tab; Chromium uses Tab.
      if (index < 3) await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
    }
    await noDocumentOverflow(page)
    expect(fixture.writes()).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('tablet: axe in read error, command error, pending and archive cooldown', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 834, height: 1194 })
  const fixture = await settingsPrivacyFixture(page)
  fixture.failures.set('read', { status: 500, code: 'INTERNAL_ERROR' })
  try {
    await ready(page)
    await expect(page.getByRole('alert')).toContainText('Не удалось загрузить статус')
    await axe(page)
    fixture.failures.delete('read')
    await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
    const dialog = await openPrivacyDialog(page)
    fixture.failures.set('grant', { status: 500, code: 'INTERNAL_ERROR' })
    await dialog.getByRole('button', { name: 'Дать согласие', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await axe(page)
    fixture.failures.delete('grant')
    fixture.hold('grant')
    await dialog.getByRole('button', { name: 'Повторить', exact: true }).click()
    await expect(dialog.locator('button[aria-busy="true"]')).toBeDisabled()
    await axe(page)
    fixture.release('grant')
    await expect(dialog).toHaveCount(0)
    fixture.failures.set('export', { status: 429, code: 'RATE_LIMITED', retryAfter: '1080' })
    await page.getByTestId('export-organization').click()
    await expect(page.getByTestId('export-organization')).toBeDisabled()
    await expect(page.getByTestId('export-organization-error')).toContainText('18 минут')
    await axe(page)
    await noDocumentOverflow(page)
    await capture(page, info, 'tablet-cooldown-axe')
    expect(fixture.writes('export')).toHaveLength(1)
  } finally {
    fixture.dispose()
  }
})

test.describe('tablet synthetic touch', () => {
  test.use({ viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true })

  test('touch tap reaches visible Data and opens/cancels the consent sheet', async ({ page }) => {
    const fixture = await settingsPrivacyFixture(page)
    try {
      await ready(page)
      const active = tabs(page).getByRole('link', { name: 'Данные', exact: true })
      await fullyInside(active, tabs(page))
      await active.tap()
      await page.getByRole('button', { name: 'Дать согласие', exact: true }).tap()
      const dialog = privacyDialog(page)
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await noDocumentOverflow(page)
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })

  test('Chromium native synthetic horizontal touch drag scrolls only the tab strip', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'CDP native synthetic touch is only available in Chromium; tap is covered in every project.',
    )
    const fixture = await settingsPrivacyFixture(page)
    try {
      await ready(page)
      const navigation = tabs(page)
      const initial = await navigation.evaluate((node) => node.scrollLeft)
      const box = await navigation.boundingBox()
      const session = await page.context().newCDPSession(page)
      try {
        const y = box!.y + box!.height / 2
        const x = box!.x + 140
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        })
        for (let step = 1; step <= 8; step++) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + step * 35, y }],
          })
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await expect
          .poll(() => navigation.evaluate((node) => node.scrollLeft))
          .toBeLessThan(initial - 100)
        await expect(page).toHaveURL(/\/settings\/privacy$/)
        await noDocumentOverflow(page)
        // Re-entry restores the approved initial offset and keeps the active Data action visible.
        await page.reload()
        await fullyInside(tabs(page).getByRole('link', { name: 'Данные', exact: true }), tabs(page))
        expect(fixture.writes()).toEqual([])
      } finally {
        await session.detach()
      }
    } finally {
      fixture.dispose()
    }
  })
})

test.describe('tablet at 200% equivalent reflow (not native browser zoom)', () => {
  test.use({ viewport: { width: 417, height: 597 }, deviceScaleFactor: 2 })

  test('long audit and legal text reflow with reachable actions and keyboard cancellation', async ({
    page,
  }, info) => {
    const fixture = await settingsPrivacyFixture(page, { initial: 'revoked', longNames: true })
    try {
      await ready(page)
      await expect(page.getByTestId('consent-audit')).toContainText(PRIVACY_LONG_NAME)
      await noDocumentOverflow(page)
      for (const link of await page
        .getByRole('region', { name: 'Документы', exact: true })
        .getByRole('link')
        .all()) {
        await link.scrollIntoViewIfNeeded()
        await expect(link).toBeInViewport()
      }
      const dialog = await openPrivacyDialog(page)
      const cancel = dialog.getByRole('button', { name: 'Отмена', exact: true })
      await cancel.focus()
      await expect(cancel).toBeInViewport()
      await noDocumentOverflow(page)
      await axe(page)
      await capture(page, info, 'tablet-200-equivalent-reflow')
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Дать согласие', exact: true })).toBeFocused()
      expect(fixture.writes()).toEqual([])
    } finally {
      fixture.dispose()
    }
  })
})
