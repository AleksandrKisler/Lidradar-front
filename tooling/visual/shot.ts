/** Общие шаги съёмки кадров: конечное состояние страницы и полный кадр с боковой колонкой. */
import type { Page } from '@playwright/test'

/** Шрифты загружены, фокуса и наведения нет; состояния запросов к этому моменту уже конечные. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0))
  await settleInPlace(page)
  await page.evaluate(
    () => document.activeElement instanceof HTMLElement && document.activeElement.blur(),
  )
}

/** То же без прокрутки к началу и снятия фокуса: кадры видимого фокуса и прокрученного окна. */
export async function settleInPlace(page: Page): Promise<void> {
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  // Переходы (например, после переключения «Список/Плитки») должны закончиться: кадр — только в конечном состоянии.
  // Бесконечные анимации (спиннер состояния «отправка») не ждём: только конечные переходы.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

/**
 * Полный кадр по высоте документа, измеренной в этот же момент. Боковая панель — `sticky` высотой
 * окна (`h-dvh`): при прокрутке пользователь видит её залитой до низа (проверено e2e «боковая
 * панель залита на всю высоту»), но в одном кадре на всю страницу она оборвалась бы на высоте окна.
 * Только для съёмки панели задаётся высота документа; на остальную раскладку это не влияет.
 */
export async function fullShot(page: Page, file: string): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const width = page.viewportSize()!.width
  await page.addStyleTag({
    content: `aside[class*="lg:sticky"] { height: ${height}px !important; }`,
  })
  const after = await page.evaluate(() => document.documentElement.scrollHeight)
  if (after !== height) {
    throw new Error(`Высота документа изменилась при растяжении панели: ${height} → ${after}`)
  }
  await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height } })
}
