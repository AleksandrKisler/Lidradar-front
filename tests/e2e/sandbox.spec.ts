import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockOwner } from './fixtures/api'
import { SANDBOX_CONVERSATION_ID, mockSandbox } from './fixtures/sandbox'

test.describe('песочница стейджа', () => {
  test('без признака в /auth/me раздела нет', async ({ page }) => {
    await mockOwner(page)
    await page.goto('/radar')
    await expect(page.getByRole('link', { name: 'Radar' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Песочница/ })).toHaveCount(0)
    await page.goto('/sandbox')
    await expect(page.getByRole('heading', { name: 'Песочница недоступна' })).toBeVisible()
  })

  test('менеджер собирает переписку по шаблону и видит совпадение', async ({ page }) => {
    await mockOwner(page, { role: 'MANAGER' })
    const sandbox = await mockSandbox(page)
    await page.goto('/radar')
    await page.getByRole('link', { name: /Песочница/ }).click()
    await expect(page).toHaveURL(/\/sandbox$/)
    await expect(page.getByRole('heading', { name: 'Создайте виртуального клиента' })).toBeVisible()

    await page.getByRole('button', { name: 'Новый клиент' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Новый клиент' })
    // Неквалифицированный шаблон тестировщикам не показывается.
    await expect(dialog.getByText('Спросили цену, бизнес не ответил')).toHaveCount(0)
    await dialog.getByLabel('Имя клиента').fill('Анна Петрова')
    await dialog.getByRole('radio', { name: /Назвали цену, клиент замолчал/ }).check()
    await dialog.getByRole('button', { name: 'Создать' }).click()

    await expect(page.getByRole('heading', { name: 'Анна Петрова' })).toBeVisible()
    await expect(page.getByText('Окрашивание — 8 000 ₽. Когда вам удобно?')).toBeVisible()
    await expect(page.getByText('прошло 10 мин')).toBeVisible()
    await expect(page.getByRole('radio', { name: '5 суток' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // Enter не отправляет: отправитель выбирается кнопкой.
    const field = page.getByLabel('Текст сообщения')
    await field.fill('Дороговато, подумаю')
    await field.press('Enter')
    await expect(page.getByText(/Выберите, от чьего имени отправить/)).toBeVisible()
    await page.getByRole('button', { name: 'От клиента' }).click()
    await expect(page.getByText('Дороговато, подумаю')).toBeVisible()
    await page.getByRole('button', { name: 'Удалить сообщение 3' }).click()
    await expect(page.getByText('Дороговато, подумаю')).toHaveCount(0)

    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
      .then(({ violations }) => {
        expect(violations).toEqual([])
      })

    await page.getByRole('button', { name: 'Отправить в систему' }).click()
    await expect(page).toHaveURL(new RegExp(`/sandbox/${SANDBOX_CONVERSATION_ID}$`))
    expect(sandbox.created).toHaveLength(1)
    expect(sandbox.created[0]).toMatchObject({
      templateCode: 'customer_silent_after_price',
      contactName: 'Анна Петрова',
      tailMinutes: 7200,
      messages: [
        { direction: 'INCOMING', pauseBeforeMinutes: 0 },
        { direction: 'OUTGOING', pauseBeforeMinutes: 10 },
      ],
    })
    await expect(page.getByText('Совпало с ожиданием')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Открыть в Radar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'В «Диалогах»' })).toBeVisible()
    await expect(page.getByText('Черновик', { exact: true })).toHaveCount(0)
  })

  test('отказ «другая переписка обрабатывается» объяснён и черновик сохраняется', async ({
    page,
  }) => {
    await mockOwner(page)
    await mockSandbox(page, { failCreate: { status: 409, code: 'SANDBOX_BUSY' } })
    await page.goto('/sandbox')
    await page.getByRole('button', { name: 'Новый клиент' }).first().click()
    await page
      .getByRole('dialog', { name: 'Новый клиент' })
      .getByRole('button', { name: 'Создать' })
      .click()
    await page.getByRole('button', { name: 'Отправить в систему' }).click()
    await expect(page.getByText('Другая переписка ещё обрабатывается')).toBeVisible()
    await expect(page.getByText('Черновик', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('Окрашивание — 8 000 ₽. Когда вам удобно?')).toBeVisible()
  })
})
