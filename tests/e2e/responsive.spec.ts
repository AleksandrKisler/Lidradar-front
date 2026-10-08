/**
 * Матрица reflow и доступности: ключевые маршруты на ширинах 320, 375, 768,
 * 1024 и 1440 CSS px плюс имитация 200 % масштаба (640 px). На каждой ширине:
 * нет горизонтальной прокрутки страницы, главное действие доступно, axe без
 * нарушений, первый Tab даёт видимый фокус. Отдельно — уважение к
 * `prefers-reduced-motion`.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { CONVERSATION_ID, RISK_ID, mockOwner } from './fixtures/api'

// Один браузер: матрица управляет шириной сама (остальные проекты исключают файл в конфигурации).
test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile === true)

const widths = [
  { name: '320', width: 320, height: 640 },
  { name: '375', width: 375, height: 812 },
  { name: 'zoom200', width: 640, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
]

interface Screen {
  name: string
  path: string
  /** Главное действие или содержимое, которое должно быть доступно на любой ширине. */
  action: (page: Page) => ReturnType<Page['getByRole']> | ReturnType<Page['getByText']>
  admin?: boolean
}

const screens: Screen[] = [
  { name: 'вход', path: '/login', action: (page) => page.getByRole('button', { name: 'Войти' }) },
  {
    name: 'Radar',
    path: '/radar',
    action: (page) => page.getByRole('list', { name: 'Список активных рисков' }),
  },
  {
    name: 'карточка риска',
    path: `/risks/${RISK_ID}`,
    action: (page) => page.getByRole('button', { name: 'Взять в работу' }),
  },
  {
    name: 'начало работы: график',
    path: '/onboarding/location',
    action: (page) => page.getByRole('button', { name: 'Сохранить и продолжить' }),
  },
  {
    name: 'начало работы: источник сообщений',
    path: '/onboarding/channel',
    action: (page) => page.getByRole('button', { name: 'Подключить источник' }),
  },
  {
    name: 'список диалогов',
    path: '/conversations',
    action: (page) => page.getByRole('list', { name: 'Список диалогов' }),
  },
  {
    name: 'переписка',
    path: `/conversations/${CONVERSATION_ID}`,
    action: (page) => page.getByRole('region', { name: 'Сообщения' }),
  },
  {
    name: 'настройки компании',
    path: '/settings/company',
    action: (page) => page.getByRole('button', { name: 'Добавить точку' }),
  },
  {
    name: 'команда',
    path: '/settings/team',
    action: (page) => page.getByRole('button', { name: 'Пригласить' }),
  },
  {
    name: 'аналитика',
    path: '/analytics',
    action: (page) => page.getByRole('list', { name: 'Главные показатели' }),
  },
  {
    name: 'мёртвые письма',
    path: '/admin/dead-letters',
    action: (page) => page.getByRole('button', { name: 'Повторить' }),
    admin: true,
  },
]

async function noPageScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const inner = window.innerWidth
    // Виновники переполнения — для диагностики в сообщении об ошибке (в координатах документа).
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right + window.scrollX > inner + 1)
      .slice(0, 5)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 80)}`,
      )
    return { scroll: document.documentElement.scrollWidth, inner, offenders }
  })
  expect(
    overflow.scroll,
    `горизонтальная прокрутка страницы запрещена; за край выходят: ${overflow.offenders.join(' | ')}`,
  ).toBeLessThanOrEqual(overflow.inner + 1)
}

async function firstTabHasVisibleFocus(page: Page): Promise<void> {
  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) return null
    const style = getComputedStyle(element)
    return { tag: element.tagName, outline: style.outlineStyle, width: style.outlineWidth }
  })
  expect(focus, 'после Tab фокус должен быть на интерактивном элементе').not.toBeNull()
  expect(focus!.outline).not.toBe('none')
  expect(parseFloat(focus!.width)).toBeGreaterThan(0)
}

for (const screen of screens) {
  test.describe(screen.name, () => {
    for (const viewport of widths) {
      test(`${viewport.name}: reflow, действие, axe и фокус`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        if (screen.path === '/login') {
          await page.route('**/api/v1/auth/me', (route) =>
            route.fulfill({
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ error: { code: 'UNAUTHENTICATED' } }),
            }),
          )
        } else {
          await mockOwner(page, screen.admin ? { platformAdmin: true } : {})
        }
        await page.goto(screen.path)
        await expect(screen.action(page)).toBeVisible()
        await noPageScroll(page)
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
        expect(axe.violations).toEqual([])
        await firstTabHasVisibleFocus(page)
      })
    }
  })
}

test('prefers-reduced-motion выключает анимацию скелетов и переходов', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockOwner(page)
  await page.goto('/radar')
  await expect(page.getByRole('list', { name: 'Список активных рисков' })).toBeVisible()
  const durations = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'animate-pulse transition-colors'
    document.body.append(probe)
    const style = getComputedStyle(probe)
    const result = { animation: style.animationDuration, transition: style.transitionDuration }
    probe.remove()
    return result
  })
  expect(parseFloat(durations.animation)).toBeLessThanOrEqual(0.01)
  expect(parseFloat(durations.transition)).toBeLessThanOrEqual(0.01)
})
