import { expect, test } from '@playwright/test'
import { CONVERSATION_ID, mockOwner, RISK_ID } from './fixtures/api'

test('стёртое сообщение сохраняет время, но скрывает текст и вложения', async ({ page }) => {
  await mockOwner(page)
  await page.route('**/api/v1/conversations/*/messages**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            message: {
              id: '01990000-0000-7000-8000-000000000803',
              conversationId: CONVERSATION_ID,
              direction: 'INCOMING',
              type: 'TEXT',
              text: 'Скрываемый текст из устаревшего ответа',
              sentAt: '2026-09-18T10:02:00Z',
              providerDeletedAt: null,
              contentErasedAt: '2026-10-17T10:00:00Z',
            },
            attachments: [{ id: 'old-file', mimeType: 'application/pdf', sizeBytes: 512 }],
          },
        ],
        nextCursor: null,
      }),
    }),
  )
  await page.goto(`/conversations/${CONVERSATION_ID}`)
  const thread = page.getByRole('region', { name: 'Сообщения' })
  await expect(thread.getByText('Текст удалён по сроку хранения')).toBeVisible()
  await expect(thread.getByText('Скрываемый текст из устаревшего ответа')).toHaveCount(0)
  await expect(thread.getByRole('list', { name: 'Вложения' })).toHaveCount(0)
  await expect(thread.locator('time[datetime="2026-09-18T10:02:00Z"]')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('erased-message.png'), fullPage: true })
})

test('истёкший ключ требует сверки и блокирует повтор действия', async ({ page }) => {
  await mockOwner(page)
  let submissions = 0
  await page.route(`**/api/v1/risks/${RISK_ID}/actions`, (route) => {
    submissions += 1
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'IDEMPOTENCY_KEY_EXPIRED', traceId: 'test' } }),
    })
  })
  await page.goto(`/risks/${RISK_ID}`)
  await page.getByLabel('Что сделано').selectOption('CALL')
  await page.getByRole('button', { name: 'Записать действие' }).click()
  await expect(page.getByText('Срок ответа по ключу истёк')).toBeVisible()
  await expect(page.getByText(/Сверьте историю действия или оплаты/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Записать действие' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Повторить отправку' })).toHaveCount(0)
  expect(submissions).toBe(1)
})
