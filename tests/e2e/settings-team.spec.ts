import { expect, test } from '@playwright/test'
import { settingsTeamFixture, TEAM_CODE } from './fixtures/settings-team'
import { TENANT_ID } from './fixtures/api'
test('R54 invitation201 preserves one-time code after GET failure and clipboard denial', async ({
  page,
}) => {
  const fixture = await settingsTeamFixture(page)
  try {
    await page.goto('/settings/team')
    await page.getByRole('button', { name: 'Пригласить участника', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[value=OWNER]').check()
    await dialog.locator('textarea').fill('Для нового коллеги')
    fixture.failures.set('invitations', { status: 500, code: 'INTERNAL_ERROR' })
    await dialog.getByRole('button', { name: 'Создать приглашение', exact: true }).click()
    await expect(dialog.getByTestId('invitation-code')).toHaveText(TEAM_CODE)
    await expect(dialog.getByText('Список приглашений не обновлён', { exact: true })).toBeVisible()
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      }),
    )
    await dialog.getByRole('button', { name: 'Скопировать код', exact: true }).click()
    await expect(dialog.getByText('Не удалось скопировать код', { exact: true })).toBeVisible()
    expect(fixture.writes()).toHaveLength(1)
    expect(fixture.writes()[0]).toMatchObject({
      endpoint: 'create',
      tenant: TENANT_ID,
      body: { role: 'OWNER', note: 'Для нового коллеги' },
    })
    await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Не удалось обновить команду' }),
    ).toBeVisible()
    await expect(page.getByText(TEAM_CODE, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Пригласить участника', exact: true }).click()
    await expect(dialog.getByTestId('invitation-code')).toHaveCount(0)
  } finally {
    fixture.dispose()
  }
})
test('R54 unchanged role and cancel send nothing; role/revoke require confirmation', async ({
  page,
}) => {
  const fixture = await settingsTeamFixture(page)
  try {
    await page.goto('/settings/team')
    await page.getByRole('button', { name: 'Изменить доступ: Анна Смирнова', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Сохранить роль', exact: true })).toBeDisabled()
    await dialog.locator('input[value=OWNER]').check()
    expect(fixture.writes()).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(fixture.writes()).toHaveLength(0)
    await page.getByRole('button', { name: 'Изменить доступ: Анна Смирнова', exact: true }).click()
    await dialog.getByRole('button', { name: 'Отозвать доступ...', exact: true }).click()
    await expect(dialog.getByText(/История действий/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Отозвать доступ', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Без доступа', exact: true })).toBeVisible()
    expect(fixture.writes()).toHaveLength(1)
    expect(fixture.members[1]!.status).toBe('DISABLED')
  } finally {
    fixture.dispose()
  }
})
test('R54 editing a saved role clears success and uses ACK baseline when the list GET failed', async ({
  page,
}) => {
  const fixture = await settingsTeamFixture(page)
  try {
    await page.goto('/settings/team')
    await page.getByRole('button', { name: 'Изменить доступ: Анна Смирнова', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[value=OWNER]').check()
    fixture.failures.set('members', { status: 500, code: 'INTERNAL_ERROR' })
    await dialog.getByRole('button', { name: 'Сохранить роль', exact: true }).click()
    await expect(dialog.getByRole('status')).toContainText('Роль изменена')
    expect(fixture.writes()).toHaveLength(1)
    await dialog.locator('input[value=MANAGER]').check()
    await expect(dialog.getByRole('status')).toHaveCount(0)
    const save = dialog.getByRole('button', { name: 'Сохранить роль', exact: true })
    await expect(save).toBeEnabled()
    expect(fixture.writes()).toHaveLength(1)
    await save.click()
    await expect(dialog.getByRole('status')).toContainText('Роль изменена')
    expect(fixture.writes().map((call) => call.body)).toEqual([
      { role: 'OWNER' },
      { role: 'MANAGER' },
    ])
    await dialog.getByRole('button', { name: 'Готово', exact: true }).click()
    await expect(
      page
        .getByRole('region', { name: 'Участники с доступом' })
        .getByRole('listitem')
        .filter({ hasText: 'Анна Смирнова' }),
    ).toContainText('Менеджер')
    expect(fixture.writes()).toHaveLength(2)
  } finally {
    fixture.dispose()
  }
})
test('R54 manager direct URL never fetches team lists', async ({ page }) => {
  const fixture = await settingsTeamFixture(page, { manager: true })
  try {
    await page.goto('/settings/team')
    await expect(page.getByText('Раздел доступен владельцу', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Команда и доступ', exact: true })).toBeVisible()
    expect(fixture.calls).toHaveLength(0)
    for (const name of ['Команда', 'Аналитика', 'Интеграции'])
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Пригласить участника', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Изменить доступ:/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Перейти в Radar', exact: true }).click()
    await expect(page).toHaveURL(/\/radar$/)
    expect(fixture.calls).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

for (const [width, height, kind] of [
  [320, 640, 'invite'],
  [375, 500, 'role'],
  [768, 600, 'role'],
  [1024, 768, 'invite'],
  [390, 390, 'revoke'],
  [1440, 600, 'role'],
] as const) {
  test(`R54 ${kind} reflow ${width}x${height}: footer and keyboard stay reachable`, async ({
    page,
  }, info) => {
    const fixture = await settingsTeamFixture(page)
    try {
      await page.setViewportSize({ width, height })
      await page.goto('/settings/team')
      if (kind === 'invite')
        await page.getByRole('button', { name: 'Пригласить участника', exact: true }).click()
      else
        await page
          .getByRole('button', { name: 'Изменить доступ: Анна Смирнова', exact: true })
          .click()
      let dialog = page.getByRole('dialog')
      if (kind === 'revoke') {
        await dialog.getByRole('button', { name: 'Отозвать доступ...', exact: true }).click()
        dialog = page.getByRole('dialog', { name: 'Отозвать доступ?', exact: true })
      }
      await expect(dialog).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      const body = dialog.locator('.sheet-body'),
        footer = dialog.locator('footer')
      const [bodyBox, footerBox] = await Promise.all([body.boundingBox(), footer.boundingBox()])
      expect(bodyBox).not.toBeNull()
      expect(footerBox).not.toBeNull()
      expect(footerBox!.y).toBeGreaterThanOrEqual(0)
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(height)
      expect(bodyBox!.height).toBeGreaterThan(0)
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      for (const button of await footer.getByRole('button').all())
        await expect(button).toBeInViewport()
      await footer.getByRole('button').first().focus()
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        )
      }
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: info.outputPath(`team-${kind}-${width}x${height}.png`) })
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      expect(fixture.writes()).toHaveLength(0)
    } finally {
      fixture.dispose()
    }
  })
}
