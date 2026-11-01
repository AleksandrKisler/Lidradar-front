/** N-ACCOUNT-LINK-COLOR-01: current header appearance; bodies/other focus findings out of scope. */
import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HEADER_ROUTES,
  headerAccount,
  openHeaderOverlay,
  readySettingsHeader,
  settingsHeaderFixture,
  settingsHeaderGeometry,
} from '../../tests/e2e/fixtures/settings-desktop-header'

const out = resolve(
  process.env.ACCOUNT_LINK_CAPTURE_OUT ?? 'artifacts/frontend-v2/account-link-color/browser',
)
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  reducedMotion: 'reduce',
  deviceScaleFactor: 1,
})

for (const adaptive of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'mobile', width: 390, height: 844 },
])
  for (const route of HEADER_ROUTES) {
    test(`account header ${route.kind} ${adaptive.name}`, async ({ page }) => {
      await page.setViewportSize(adaptive)
      const fixture = await settingsHeaderFixture(page, route.kind)
      const folder = resolve(out, route.kind, adaptive.name)
      mkdirSync(folder, { recursive: true })
      try {
        const visit = async () => {
          await page.goto(route.path)
          await expect(page.getByRole('heading', { name: route.title, exact: true })).toBeVisible()
          await readySettingsHeader(page)
        }
        await visit()
        const geometry = await settingsHeaderGeometry(page)
        const clip =
          adaptive.name === 'desktop'
            ? { x: 280, y: 32, width: 1120, height: 44 }
            : { x: 0, y: 0, width: adaptive.width, height: adaptive.name === 'tablet' ? 72 : 64 }
        const link = headerAccount(page, adaptive.name === 'desktop')
        const color = adaptive.name === 'mobile' ? 'rgb(0, 113, 227)' : 'rgb(0, 91, 181)'
        await expect(link).toHaveCSS('color', color)
        await page.screenshot({ path: resolve(folder, 'main.png'), fullPage: true })
        await page.screenshot({ path: resolve(folder, 'header.png'), clip })
        await link.hover()
        await expect(link).toHaveCSS('color', color)
        await page.screenshot({ path: resolve(folder, 'hover.png'), clip })
        await link.focus()
        await expect(link).toBeFocused()
        await expect(link).toHaveCSS('color', color)
        await page.screenshot({ path: resolve(folder, 'focus.png'), clip })
        await link.click()
        await expect(page).toHaveURL(/\/account$/)
        await visit()
        await expect(link).toHaveCSS('color', color)
        await page.screenshot({ path: resolve(folder, 'after-account-visit.png'), clip })
        await page
          .getByRole('button', {
            name:
              route.kind === 'notifications'
                ? 'Изменить: Нет ответа клиенту'
                : route.kind === 'team'
                  ? 'Пригласить участника'
                  : 'Дать согласие',
            exact: true,
          })
          .scrollIntoViewIfNeeded()
        const beforeOverlay = await settingsHeaderGeometry(page)
        await openHeaderOverlay(page, route.kind)
        await expect(page.getByRole('dialog')).toBeVisible()
        const overlay = await settingsHeaderGeometry(page)
        expect(overlay.account.color).toBe(color)
        expect(overlay.account).toEqual(beforeOverlay.account)
        await page.screenshot({ path: resolve(folder, 'dialog-context.png'), fullPage: true })
        await page.screenshot({ path: resolve(folder, 'dialog-header.png'), clip })
        expect(fixture.writes()).toHaveLength(0)
        writeFileSync(
          resolve(folder, 'record.json'),
          JSON.stringify(
            {
              route,
              adaptive,
              color,
              clip,
              geometry,
              beforeOverlay,
              overlay,
              writes: fixture.writes(),
              locale: 'ru-RU',
              timezone: 'Europe/Moscow',
              browser: page.context().browser()?.version(),
              scale: 1,
            },
            null,
            2,
          ) + '\n',
        )
      } finally {
        fixture.dispose()
      }
    })
  }
