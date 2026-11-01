import { expect, test } from '@playwright/test'
import {
  HEADER_ROUTES,
  headerAccount,
  openHeaderOverlay,
  readySettingsHeader,
  settingsHeaderFixture,
  settingsHeaderGeometry,
} from './fixtures/settings-desktop-header'

test.use({ locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'reduce' })
for (const route of HEADER_ROUTES) {
  test(`desktop header ${route.kind}: owner correction and downstream intervals`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const fixture = await settingsHeaderFixture(page, route.kind)
    try {
      await page.goto(route.path)
      await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible()
      await readySettingsHeader(page)
      const geometry = await settingsHeaderGeometry(page)
      await info.attach('desktop-header-geometry', {
        body: JSON.stringify({ route, geometry }, null, 2),
        contentType: 'application/json',
      })
      expect(geometry.shellHeader).toMatchObject({
        x: 280,
        y: 32,
        width: 1120,
        height: 44,
        visible: true,
      })
      expect(geometry.account).toMatchObject({
        color: 'rgb(0, 113, 227)',
        href: '/account',
        height: 44,
      })
      expect(geometry.title.y - geometry.shellHeader.bottom).toBe(24)
      expect(geometry.tabs.y - geometry.titleHeader.bottom).toBe(24)
      expect(geometry.firstSection.y - geometry.tabs.bottom).toBe(24)
      expect(geometry.main.paddingBottom).toBe(route.kind === 'privacy' ? '32px' : '24px')
      expect(geometry.document.width).toBe(1440)
      await headerAccount(page, true).click()
      await expect(page).toHaveURL(/\/account$/)
    } finally {
      fixture.dispose()
    }
  })
  test(`desktop header ${route.kind}: real overlay keeps the corrected background`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const fixture = await settingsHeaderFixture(page, route.kind)
    try {
      await page.goto(route.path)
      await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible()
      await readySettingsHeader(page)
      const before = await settingsHeaderGeometry(page)
      await openHeaderOverlay(page, route.kind)
      const overlay = await settingsHeaderGeometry(page)
      await info.attach('overlay-header-geometry', {
        body: JSON.stringify({ route, before, overlay }, null, 2),
        contentType: 'application/json',
      })
      expect(overlay.shellHeader).toEqual(before.shellHeader)
      expect(overlay.shellHeader).toMatchObject({ x: 280, y: 32, width: 1120, height: 44 })
      expect(overlay.account).toEqual(before.account)
      expect(overlay.account.color).toBe('rgb(0, 113, 227)')
      expect(overlay.title).toEqual(before.title)
      expect(overlay.dialogs).toHaveLength(1)
      expect(fixture.writes()).toHaveLength(0)
      await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect((await settingsHeaderGeometry(page)).shellHeader).toEqual(before.shellHeader)
    } finally {
      fixture.dispose()
    }
  })
  for (const adaptive of [
    { name: 'tablet', width: 834, height: 1194 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`adaptive header ${route.kind} ${adaptive.name}: preserves existing app bar and account`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: adaptive.width, height: adaptive.height })
      const fixture = await settingsHeaderFixture(page, route.kind)
      try {
        await page.goto(route.path)
        await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible()
        await readySettingsHeader(page)
        const geometry = await settingsHeaderGeometry(page)
        await info.attach('adaptive-header-geometry', {
          body: JSON.stringify({ route, adaptive, geometry }, null, 2),
          contentType: 'application/json',
        })
        expect(geometry.appbar).toMatchObject({
          x: 0,
          y: 0,
          width: adaptive.width,
          height: adaptive.name === 'tablet' ? 72 : 64,
          visible: true,
        })
        expect(geometry.account.height).toBe(44)
        expect(geometry.account.y).toBe(adaptive.name === 'tablet' ? 13.5 : 9.5)
        expect(geometry.account.color).toBe(
          adaptive.name === 'mobile'
            ? 'rgb(0, 113, 227)'
            : route.kind === 'privacy'
              ? 'rgb(0, 91, 181)'
              : 'rgb(29, 29, 31)',
        )
        expect(geometry.title.y).toBe(
          route.kind === 'privacy'
            ? adaptive.name === 'tablet'
              ? 138
              : 114
            : adaptive.name === 'tablet'
              ? 96
              : 88,
        )
        expect(geometry.shellHeader.visible).toBe(route.kind === 'privacy')
        expect(geometry.document.width).toBe(adaptive.width)
        await headerAccount(page, false).click()
        await expect(page).toHaveURL(/\/account$/)
      } finally {
        fixture.dispose()
      }
    })
  }
}
