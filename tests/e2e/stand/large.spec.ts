/** Сеть студий: курсорные списки без дублей и без N+1, аналитика за большой объём. */
import { apiSnapshot, expect, openStand, requireStand, riskDetailRequests, test } from './support'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })

test.describe('стенд · сеть студий', () => {
  requireStand()

  for (const width of [320, 375]) {
    test(`QA-03: список диалогов помещается в ${width} px после reload и подгрузки`, async ({
      browser,
      baseURL,
    }) => {
      const stand = await openStand(browser, baseURL!, 'large')
      const { page } = stand
      try {
        await page.setViewportSize({ width, height: 812 })
        await page.goto('/conversations')
        const list = page.getByRole('list', { name: 'Список диалогов' })
        const links = list.getByRole('link')
        const fits = async () => {
          await expect(links.first()).toBeVisible()
          const dimensions = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
          }))
          expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(width + 1)
          const bounds = await list.boundingBox()
          expect(bounds).not.toBeNull()
          expect(bounds!.x).toBeGreaterThanOrEqual(0)
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
        }
        await fits()
        await page.reload()
        await fits()
        const firstPage = await links.count()
        await page.getByRole('button', { name: 'Показать ещё' }).click()
        await expect.poll(() => links.count()).toBeGreaterThan(firstPage)
        await fits()

        await links.first().click()
        await expect(page.getByRole('region', { name: 'Сообщения' })).toBeVisible()
        await page.getByRole('link', { name: '← К списку' }).click()
        await fits()
      } finally {
        await stand.context.close()
      }
    })
  }

  test('лента рисков листается курсором без дублей и без чтения карточек', async ({
    browser,
    baseURL,
  }) => {
    const stand = await openStand(browser, baseURL!, 'large')
    const { page, requests } = stand
    await page.goto('/radar')
    const feed = page.getByRole('list', { name: 'Список активных рисков' })
    await expect(feed).toBeVisible()
    const summary = await apiSnapshot<{ openRisks: number }>(stand, '/api/v1/radar')
    expect(summary.openRisks).toBeGreaterThan(20)
    const cards = feed.locator(':scope > li')
    const firstPage = await cards.count()
    expect(firstPage).toBeGreaterThan(0)
    // Две подгрузки: каждая добавляет страницу, идентификаторы не повторяются.
    for (let step = 0; step < 2; step += 1) {
      const more = page.getByRole('button', { name: 'Показать ещё' })
      if ((await more.count()) === 0) break
      const before = await cards.count()
      await more.click()
      await expect.poll(() => cards.count()).toBeGreaterThan(before)
    }
    const hrefs = await feed
      .getByRole('link')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href')).filter(Boolean),
      )
    expect(new Set(hrefs).size, 'страницы ленты не дублируются').toBe(hrefs.length)
    expect(riskDetailRequests(requests), 'лента не читает карточки построчно').toBe(0)
    await stand.context.close()
  })

  test('диалоги и сообщения листаются курсором без дублей', async ({ browser, baseURL }) => {
    const stand = await openStand(browser, baseURL!, 'large')
    const { page, requests } = stand
    await page.goto('/conversations')
    const list = page.getByRole('list', { name: 'Список диалогов' })
    await expect(list.getByRole('link').first()).toBeVisible()
    const more = page.getByRole('button', { name: 'Показать ещё' })
    if ((await more.count()) > 0) {
      const before = await list.getByRole('link').count()
      await more.click()
      await expect.poll(() => list.getByRole('link').count()).toBeGreaterThan(before)
    }
    const hrefs = await list
      .getByRole('link')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute('href')).filter(Boolean),
      )
    expect(new Set(hrefs).size).toBe(hrefs.length)
    // Строки списка уже содержат контакт и превью: запросов деталей на строку нет.
    const detailRequests = requests.filter((item) =>
      /\/api\/v1\/conversations\/[0-9a-f-]{36}$/.test(new URL(item.url).pathname),
    )
    expect(detailRequests).toHaveLength(0)

    await list.getByRole('link').first().click()
    await expect(page.getByRole('region', { name: 'Сообщения' })).toBeVisible()
    const earlier = page.getByRole('button', { name: /ранние сообщения/i })
    if ((await earlier.count()) > 0) {
      const messages = page.getByRole('region', { name: 'Сообщения' }).getByRole('listitem')
      const before = await messages.count()
      await earlier.click()
      await expect.poll(() => messages.count()).toBeGreaterThan(before)
    }
    await stand.context.close()
  })

  test('аналитика по трём точкам загружается одним снимком', async ({ browser, baseURL }) => {
    const stand = await openStand(browser, baseURL!, 'large')
    const { page, requests } = stand
    await page.goto('/analytics')
    await expect(page.getByTestId('analytics-period')).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Точность сигналов по типам' }).locator('tbody tr'),
    ).toHaveCount(5)
    const summaryRequests = requests.filter((item) =>
      item.url.includes('/api/v1/analytics/summary'),
    )
    expect(summaryRequests.length, 'сводка запрашивается один раз').toBe(1)
    const locations = await apiSnapshot<{ items: unknown[] }>(stand, '/api/v1/locations')
    expect(locations.items.length).toBeGreaterThanOrEqual(3)
    await stand.context.close()
  })
})
