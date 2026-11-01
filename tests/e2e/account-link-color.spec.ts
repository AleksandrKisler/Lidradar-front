import { expect, test, type Locator, type Page } from '@playwright/test'
import { CONVERSATION_ID, RISK_ID, mockOwner } from './fixtures/api'

const linkColor = 'rgb(0, 91, 181)'
const brandColor = 'rgb(0, 113, 227)'
const routes = [
  '/radar',
  `/risks/${RISK_ID}`,
  '/conversations',
  `/conversations/${CONVERSATION_ID}`,
  '/sandbox',
  '/analytics',
  '/integrations',
  '/settings/company',
  '/settings/services',
  '/settings/notifications',
  '/settings/team',
  '/settings/privacy',
  '/settings/account',
  '/workspaces',
  '/account',
]

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })

async function ready(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function appearance(link: Locator) {
  return link.evaluate((element) => {
    const box = element.getBoundingClientRect(),
      style = getComputedStyle(element)
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      fontWeight: style.fontWeight,
      href: element.getAttribute('href'),
    }
  })
}

for (const adaptive of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  for (const path of routes) {
    test(`account link ${adaptive.name} ${path}: uniform text color and interaction states`, async ({
      page,
    }, info) => {
      await page.setViewportSize(adaptive)
      await mockOwner(page)
      await page.goto(path)
      await ready(page, path)
      const textLinks = page
        .getByRole('link', { name: /^Аккаунт(?:\s*→)?$/ })
        .and(page.locator('a[href="/account"]'))
        .filter({ visible: true })
      const hasText = await textLinks.count()
      // Narrow RadarShell uses an avatar, not the text link. Its brand color is unchanged.
      const link = hasText
        ? textLinks
        : page.getByRole('link', { name: /^Аккаунт,/ }).filter({ visible: true })
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute('href', '/account')
      const expectedColor = hasText ? linkColor : brandColor
      const normal = await appearance(link)
      await expect(link).toHaveCSS('color', expectedColor)
      await link.hover()
      await expect(link).toHaveCSS('color', expectedColor)
      expect(await appearance(link)).toEqual(normal)
      await link.focus()
      await expect(link).toBeFocused()
      await expect(link).toHaveCSS('color', expectedColor)
      expect(await appearance(link)).toEqual(normal)
      if (!hasText) expect(normal).toMatchObject({ width: 44, height: 44 })
      const brand = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim(),
      )
      expect(brand.toLowerCase()).toBe('#0071e3')
      await link.click()
      await expect(page).toHaveURL(/\/account$/)
      await page.goto(path)
      await ready(page, path)
      await expect(link).toHaveCSS('color', expectedColor)
      expect(await appearance(link)).toEqual(normal)
      await info.attach('account-link-states', {
        body: JSON.stringify(
          {
            path,
            adaptive,
            hasText: Boolean(hasText),
            expectedColor,
            normal,
            hover: 'PASS',
            focus: 'PASS',
            afterAccountVisit: 'PASS',
            brand,
          },
          null,
          2,
        ),
        contentType: 'application/json',
      })
    })
  }
}
