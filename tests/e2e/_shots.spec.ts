import { test } from '@playwright/test'
import { mockOwner } from './fixtures/api'

for (const [n, w] of [['d1440', 1440], ['t1024', 1024], ['m375', 375]] as const) {
  test('cards ' + n, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1000 })
    await mockOwner(page)
    await page.goto('/analytics')
    await page.waitForSelector('[aria-label="Сообщения"]')
    await page.waitForTimeout(1400)
    const wrap = page.locator('[aria-labelledby="chart-title"]').locator('xpath=..')
    await wrap.screenshot({ path: '/private/tmp/claude-501/-Users-aleksandrkisler-WebstormProjects-Lidradar/b2b8f64e-f459-4c1e-9a1c-78a8090cef7d/scratchpad/shots/c3-top-' + n + '.png' })
    await page.locator('[aria-label="Сообщения"]').locator('xpath=../../..').screenshot({ path: '/private/tmp/claude-501/-Users-aleksandrkisler-WebstormProjects-Lidradar/b2b8f64e-f459-4c1e-9a1c-78a8090cef7d/scratchpad/shots/c3-grid-' + n + '.png' })
  })
}
