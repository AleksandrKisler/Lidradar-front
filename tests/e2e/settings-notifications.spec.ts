import { expect, test } from '@playwright/test'
import { TENANT_ID } from './fixtures/api'
import {
  NOTIFICATION_RULES,
  NOTIFICATIONS_NOW,
  NOTIFICATIONS_OTHER_TENANT,
  notificationEditor,
  openNotificationEditor,
  refreshNotifications,
  settingsNotificationsFixture,
} from './fixtures/settings-notifications'

type TelegramCleanupProbe = {
  activePollTimers: number
  lastPollTimer: number | null
  firedAfterClose: number
  safetyTicksAfterClose: number
  timeoutsAfterClose: number
  inFlight: number
  closed: boolean
}

async function installTelegramCleanupProbe(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const state: TelegramCleanupProbe = {
      activePollTimers: 0,
      lastPollTimer: null,
      firedAfterClose: 0,
      safetyTicksAfterClose: 0,
      timeoutsAfterClose: 0,
      inFlight: 0,
      closed: false,
    }
    ;(
      window as typeof window & { __telegramCleanupProbe: TelegramCleanupProbe }
    ).__telegramCleanupProbe = state
    const active = new Set<number>()
    const timeout = window.setTimeout.bind(window)
    const clear = window.clearTimeout.bind(window)
    const interval = window.setInterval.bind(window)
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler !== 'function' || delay !== 5000) return timeout(handler, delay, ...args)
      let id = 0
      id = timeout(
        (...values: unknown[]) => {
          active.delete(id)
          state.activePollTimers = active.size
          if (state.closed) state.firedAfterClose++
          return handler.apply(window, values)
        },
        delay,
        ...args,
      )
      active.add(id)
      state.activePollTimers = active.size
      state.lastPollTimer = id
      return id
    }) as typeof window.setTimeout
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined) active.delete(id)
      state.activePollTimers = active.size
      clear(id)
    }) as typeof window.clearTimeout
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof handler !== 'function' || delay !== 15000) return interval(handler, delay, ...args)
      return interval(
        (...values: unknown[]) => {
          if (state.closed) state.safetyTicksAfterClose++
          return handler.apply(window, values)
        },
        delay,
        ...args,
      )
    }) as typeof window.setInterval
    const network = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null
      const path = new URL(request?.url ?? String(input), location.origin).pathname
      const tracked = path.startsWith('/api/v1/') && path !== '/api/v1/events'
      const signal = init?.signal ?? request?.signal
      if (tracked) {
        state.inFlight++
        signal?.addEventListener(
          'abort',
          () => {
            const reason: unknown = signal.reason
            if (
              state.closed &&
              reason &&
              typeof reason === 'object' &&
              'name' in reason &&
              reason.name === 'TimeoutError'
            )
              state.timeoutsAfterClose++
          },
          { once: true },
        )
      }
      try {
        const response = await network(input, init)
        if (tracked)
          void response
            .clone()
            .arrayBuffer()
            .then(
              () => {
                state.inFlight--
              },
              () => {
                state.inFlight--
              },
            )
        return response
      } catch (error) {
        if (tracked) state.inFlight--
        throw error
      }
    }
  })
}

const telegramCleanupProbe = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      (window as typeof window & { __telegramCleanupProbe: TelegramCleanupProbe })
        .__telegramCleanupProbe,
  )

test('R47 renders all six effective rules and saves only the selected type with a complete body', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    await page.goto('/settings/notifications')
    const list = page.getByRole('list', { name: 'Настройки по типам рисков' })
    await expect(list.getByRole('listitem')).toHaveCount(6)
    for (const [, title] of NOTIFICATION_RULES)
      await expect(list.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const before = structuredClone(fixture.rows)
    for (const [index, [riskType]] of NOTIFICATION_RULES.entries()) {
      const dialog = await openNotificationEditor(page, index)
      await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
      await dialog.locator(`select[name=mode-${riskType}]`).selectOption('IMMEDIATE')
      await dialog.locator(`select[name=severity-${riskType}]`).selectOption('MEDIUM')
      await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
      await expect(
        dialog.getByRole('status').filter({ hasText: 'Настройка сохранена' }),
      ).toBeVisible()
      expect(fixture.writes('save')).toHaveLength(index + 1)
      expect(fixture.writes('save')[index]).toMatchObject({
        method: 'PUT',
        path: `/api/v1/notifications/preferences/${riskType}`,
        tenant: TENANT_ID,
        body: {
          deliveryMode: 'IMMEDIATE',
          minimumSeverity: 'MEDIUM',
          inAppEnabled: before[index]!.inAppEnabled,
          telegramEnabled: before[index]!.telegramEnabled,
          quietHoursEnabled: before[index]!.quietHoursEnabled,
          digestTime: '09:00',
          ...(before[index]!.quietHoursEnabled
            ? { quietHoursStart: '22:00', quietHoursEnd: '08:00' }
            : {}),
        },
      })
      // Exact keys catch dropped fields as well as accidental tenant/risk fields in the body.
      expect(fixture.writes('save')[index]!.body).toEqual({
        deliveryMode: 'IMMEDIATE',
        minimumSeverity: 'MEDIUM',
        inAppEnabled: before[index]!.inAppEnabled,
        telegramEnabled: before[index]!.telegramEnabled,
        quietHoursEnabled: before[index]!.quietHoursEnabled,
        digestTime: '09:00',
        ...(before[index]!.quietHoursEnabled
          ? { quietHoursStart: '22:00', quietHoursEnd: '08:00' }
          : {}),
      })
      for (let untouched = index + 1; untouched < 6; untouched++)
        expect(fixture.rows[untouched]).toEqual(before[untouched])
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
      await expect(dialog).toHaveCount(0)
    }
    expect(fixture.writes('reset')).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 clean/cancel/dirty discard never autosave and preserve the draft while continuing', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    await page.goto('/settings/notifications')
    let dialog = await openNotificationEditor(page)
    await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Изменить: Нет ответа клиенту', exact: true }),
    ).toBeFocused()
    dialog = await openNotificationEditor(page)
    await dialog.locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    const discard = page.getByRole('dialog', { name: 'Закрыть без сохранения?', exact: true })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('CRITICAL')
    await page.keyboard.press('Escape')
    await discard.getByRole('button', { name: 'Не сохранять', exact: true }).click()
    dialog = await openNotificationEditor(page)
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('HIGH')
    expect(fixture.writes()).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 busy blocks repeat submit and dismissal; rejected save preserves draft and permits one retry', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    await page.goto('/settings/notifications')
    const dialog = await openNotificationEditor(page)
    await dialog.locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
    fixture.hold('save')
    fixture.failures.set('save', { status: 500, code: 'INTERNAL_ERROR' })
    await dialog.locator('form').evaluate((form) => {
      ;(form as HTMLFormElement).requestSubmit()
      ;(form as HTMLFormElement).requestSubmit()
    })
    await expect(dialog.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    expect(fixture.writes('save')).toHaveLength(1)
    fixture.release('save')
    await expect(
      dialog.getByRole('button', { name: 'Повторить сохранение', exact: true }),
    ).toBeEnabled()
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('CRITICAL')
    expect(fixture.rows[0]!.minimumSeverity).toBe('HIGH')
    fixture.failures.delete('save')
    await dialog.getByRole('button', { name: 'Повторить сохранение', exact: true }).click()
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Настройка сохранена' }),
    ).toBeVisible()
    expect(fixture.writes('save')).toHaveLength(2)
    expect(fixture.writes('save')[1]!.body).toEqual(fixture.writes('save')[0]!.body)
  } finally {
    fixture.dispose()
  }
})

for (const locale of ['ru-RU', 'en-US']) {
  test.describe(`R47 time controls ${locale}`, () => {
    test.use({ locale })
    test('DIGEST rejects missing/equal boundaries and saves24-hour midnight/overnight values', async ({
      page,
    }) => {
      const fixture = await settingsNotificationsFixture(page, { linked: false })
      try {
        await page.goto('/settings/notifications')
        const dialog = await openNotificationEditor(page)
        await dialog.locator('select[name=mode-NO_RESPONSE]').selectOption('DIGEST')
        await dialog.locator('input[name=digest-NO_RESPONSE]').fill('')
        await dialog.locator('input[name=quiet-NO_RESPONSE]').check()
        await dialog.locator('input[name=quiet-start-NO_RESPONSE]').fill('22:00')
        await dialog.locator('input[name=quiet-end-NO_RESPONSE]').fill('22:00')
        await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
        await expect(dialog.getByText('Укажите время сводки', { exact: true })).toBeVisible()
        await expect(
          dialog.getByText('Границы тихих часов должны различаться', { exact: true }),
        ).toBeVisible()
        expect(fixture.writes()).toHaveLength(0)
        await dialog.locator('input[name=digest-NO_RESPONSE]').fill('00:00')
        await dialog.locator('input[name=quiet-start-NO_RESPONSE]').fill('23:59')
        await dialog.locator('input[name=quiet-end-NO_RESPONSE]').fill('00:00')
        await expect(dialog.locator('input[name=digest-NO_RESPONSE]')).toHaveAttribute(
          'type',
          'text',
        )
        await expect(dialog.locator('input[name=digest-NO_RESPONSE]')).toHaveValue('00:00')
        await expect(dialog.getByText(/через полночь/)).toBeVisible()
        await expect(dialog.getByText(/Telegram не подключён/)).toBeVisible()
        await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
        await expect(
          dialog.getByRole('status').filter({ hasText: 'Настройка сохранена' }),
        ).toBeVisible()
        expect(fixture.writes('save')[0]!.body).toEqual({
          deliveryMode: 'DIGEST',
          minimumSeverity: 'HIGH',
          inAppEnabled: true,
          telegramEnabled: true,
          quietHoursEnabled: true,
          quietHoursStart: '23:59',
          quietHoursEnd: '00:00',
          digestTime: '00:00',
        })
      } finally {
        fixture.dispose()
      }
    })
  })
}

test('R47 reset confirms only one DELETE; ACK followed by GET failure retries only the read', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    await page.goto('/settings/notifications')
    const before = structuredClone(fixture.rows)
    const dialog = await openNotificationEditor(page)
    await dialog.getByRole('button', { name: 'Вернуть по умолчанию', exact: true }).click()
    let reset = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Оставить мои', exact: true }) })
    await reset.getByRole('button', { name: 'Оставить мои', exact: true }).click()
    expect(fixture.writes()).toHaveLength(0)
    await dialog.getByRole('button', { name: 'Вернуть по умолчанию', exact: true }).click()
    reset = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Оставить мои', exact: true }) })
    fixture.failures.set('preferences', { status: 500, code: 'INTERNAL_ERROR' })
    await reset.getByRole('button', { name: 'Вернуть', exact: true }).click()
    await expect(reset.getByText(/Сброс подтверждён/)).toBeVisible()
    expect(fixture.writes('reset')).toHaveLength(1)
    expect(fixture.writes('reset')[0]).toMatchObject({
      path: '/api/v1/notifications/preferences/NO_RESPONSE',
      tenant: TENANT_ID,
    })
    fixture.failures.delete('preferences')
    await reset.getByRole('button', { name: 'Повторить чтение', exact: true }).click()
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('LOW')
    await expect(
      dialog.getByRole('button', { name: 'Вернуть по умолчанию', exact: true }),
    ).toHaveCount(0)
    expect(fixture.rows[0]!.isDefault).toBe(true)
    expect(fixture.rows.slice(1)).toEqual(before.slice(1))
    expect(fixture.writes('reset')).toHaveLength(1)
    expect(fixture.writes('save')).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 initial error has no fabricated rules; stale refresh failure retains rows and dirty draft', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    fixture.failures.set('preferences', { status: 403, code: 'FORBIDDEN' })
    await page.goto('/settings/notifications')
    await expect(page.getByText('Не удалось загрузить правила', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(0)
    fixture.failures.delete('preferences')
    await page.getByRole('button', { name: /Повторить/ }).click()
    await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(6)
    const dialog = await openNotificationEditor(page)
    await dialog.locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
    fixture.rows[0]!.minimumSeverity = 'LOW'
    await refreshNotifications(page)
    await expect
      .poll(() => fixture.calls.filter((call) => call.endpoint === 'preferences').length)
      .toBeGreaterThan(2)
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('CRITICAL')
    // A second focus-driven refresh must not remove confirmed rows or the local draft.
    await expect(
      page.locator('ul[aria-label="Настройки по типам рисков"] > li').first(),
    ).toContainText('Сразу · Все риски')
    fixture.failures.set('preferences', { status: 403, code: 'FORBIDDEN' })
    await page.clock.setFixedTime(new Date('2026-11-01T08:47:00Z'))
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.getByText('Правила не обновлены', { exact: true })).toBeAttached()
    await expect(page.locator('button[aria-label^="Изменить:"]')).toHaveCount(6)
    await expect(dialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('CRITICAL')
    expect(fixture.writes()).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 Telegram issuing/pending/manual check/expiry/reissue and disconnect are distinct actions', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page, { linked: false })
  await page.clock.install({ time: new Date(NOTIFICATIONS_NOW) })
  await page.clock.pauseAt(new Date(NOTIFICATIONS_NOW))
  await installTelegramCleanupProbe(page)
  try {
    await page.goto('/settings/notifications')
    await expect(
      page.getByText(
        'Telegram выбран в правилах, но сообщения начнут приходить только после личной привязки.',
        { exact: true },
      ),
    ).toBeVisible()
    fixture.hold('issue')
    await page.getByRole('button', { name: 'Подключить Telegram', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ visible: true })
    await expect(dialog.getByText('Готовим одноразовую ссылку…', { exact: true })).toBeVisible()
    fixture.release('issue')
    await expect(dialog.getByRole('link', { name: 'Открыть бота', exact: true })).toHaveAttribute(
      'href',
      fixture.telegram.startUrl,
    )
    expect(fixture.telegram.linked).toBe(false)
    fixture.hold('status')
    await dialog.getByRole('button', { name: 'Проверить привязку', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Проверяем…', exact: true })).toBeDisabled()
    fixture.release('status')
    await expect(dialog.getByText(/Привязка ещё не завершена/)).toBeVisible()
    await page.clock.runFor(15 * 60_000 + 1)
    await expect(dialog.getByText('Срок ссылки истёк', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Открыть бота', exact: true })).toHaveCount(0)
    fixture.telegram.expiresAt = '2026-11-01T09:15:00Z'
    await dialog.getByRole('button', { name: 'Выпустить новую ссылку', exact: true }).click()
    await expect(dialog.getByRole('link', { name: 'Открыть бота', exact: true })).toBeVisible()
    fixture.telegram.linked = true
    await dialog.getByRole('button', { name: 'Проверить привязку', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'Управлять', exact: true }).click()
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    expect(fixture.writes('disconnect')).toHaveLength(0)
    await page.getByRole('button', { name: 'Управлять', exact: true }).click()
    await dialog.getByRole('button', { name: 'Отключить', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(fixture.writes('issue')).toHaveLength(2)
    expect(fixture.writes('disconnect')).toHaveLength(1)
    expect(fixture.writes('save')).toHaveLength(0)
    expect(fixture.writes().every((call) => call.tenant === TENANT_ID)).toBe(true)
    await page.evaluate(() => {
      ;(
        window as typeof window & { __telegramCleanupProbe: TelegramCleanupProbe }
      ).__telegramCleanupProbe.closed = true
    })
    const initialProbe = await telegramCleanupProbe(page)
    expect(initialProbe.lastPollTimer).not.toBeNull()
    expect(initialProbe.activePollTimers).toBe(0)
    await expect.poll(async () => (await telegramCleanupProbe(page)).inFlight).toBe(0)
    const readCount = fixture.calls.filter((call) => call.endpoint === 'status').length
    const preferenceReads = fixture.calls.filter((call) => call.endpoint === 'preferences').length
    // Complete real HTTP before advancing fake time again. Natural safety/SSE
    // invalidations may coalesce; cleanup forbids timers and status-only reads.
    for (let step = 0; step < 6; step++) {
      await page.clock.runFor(5000)
      await expect.poll(async () => (await telegramCleanupProbe(page)).inFlight).toBe(0)
      const probe = await telegramCleanupProbe(page)
      expect(probe.activePollTimers).toBe(0)
      expect(probe.firedAfterClose).toBe(0)
      expect(probe.timeoutsAfterClose).toBe(0)
      await expect
        .poll(
          () =>
            fixture.calls.filter((call) => call.endpoint === 'status').length -
            readCount -
            (fixture.calls.filter((call) => call.endpoint === 'preferences').length -
              preferenceReads),
        )
        .toBe(0)
    }
    expect((await telegramCleanupProbe(page)).safetyTicksAfterClose).toBe(2)
  } finally {
    fixture.dispose()
  }
})

test('R47 Telegram rejects unsafe URL, preserves error/retry and stops polling after close', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page, { linked: false })
  await page.clock.install({ time: new Date(NOTIFICATIONS_NOW) })
  await page.clock.pauseAt(new Date(NOTIFICATIONS_NOW))
  try {
    fixture.failures.set('issue', { status: 500, code: 'INTERNAL_ERROR' })
    await page.goto('/settings/notifications')
    await page.getByRole('button', { name: 'Подключить Telegram', exact: true }).click()
    const dialog = page.getByRole('dialog').filter({ visible: true })
    await expect(dialog.getByRole('alert')).toBeVisible()
    expect(fixture.writes('issue')).toHaveLength(1)
    fixture.failures.delete('issue')
    fixture.telegram.startUrl = 'javascript:alert("synthetic")'
    await dialog.getByRole('button', { name: 'Повторить', exact: true }).click()
    await expect(dialog.getByText('Ссылка привязки непригодна', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Открыть бота', exact: true })).toHaveCount(0)
    await dialog.locator('footer').getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    const readCount = fixture.calls.filter((call) => call.endpoint === 'status').length
    const preferenceReads = fixture.calls.filter((call) => call.endpoint === 'preferences').length
    // No token-specific 5s polling survives close. Global reconciliation runs every15s;
    // the silent SSE fixture also reconnects/resyncs after45s (+250ms), adding one GET pair.
    for (let step = 1; step <= 12; step++) {
      const expected = Math.floor(step / 3) + (step >= 10 ? 1 : 0)
      const previous = Math.floor((step - 1) / 3) + (step - 1 >= 10 ? 1 : 0)
      const responses =
        expected > previous
          ? ['telegram-link', 'preferences'].map((endpoint) =>
              page.waitForResponse(
                (response) =>
                  response.request().method() === 'GET' &&
                  response.url().endsWith(`/notifications/${endpoint}`),
              ),
            )
          : []
      await page.clock.runFor(5000)
      await expect
        .poll(() => [
          fixture.calls.filter((call) => call.endpoint === 'status').length - readCount,
          fixture.calls.filter((call) => call.endpoint === 'preferences').length - preferenceReads,
        ])
        .toEqual([expected, expected])
      await Promise.all(responses.map(async (response) => (await response).finished()))
    }
  } finally {
    fixture.dispose()
  }
})

test('R47 manager can edit personal rules without requests to owner-only team endpoints', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page, { manager: true })
  const teamRequests: string[] = []
  page.on('request', (request) => {
    if (/\/organization\/(members|invitations)/.test(request.url()))
      teamRequests.push(request.url())
  })
  try {
    await page.goto('/settings/notifications')
    const dialog = await openNotificationEditor(page)
    await dialog.locator('select[name=mode-NO_RESPONSE]').selectOption('DISABLED')
    await expect(
      dialog.getByText('Риски остаются в Radar. Уведомлений об этом типе не будет.', {
        exact: true,
      }),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Настройка сохранена' }),
    ).toBeVisible()
    expect(fixture.writes('save')[0]).toMatchObject({
      tenant: TENANT_ID,
      body: { deliveryMode: 'DISABLED' },
    })
    expect(teamRequests).toEqual([])
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Команда', exact: true })).toHaveCount(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 tenant switch closes editor and ignores the old held save response', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fixture = await settingsNotificationsFixture(page, { multiTenant: true })
  try {
    await page.goto('/settings/notifications')
    const dialog = await openNotificationEditor(page)
    await dialog.locator('select[name=severity-NO_RESPONSE]').selectOption('CRITICAL')
    fixture.hold('save')
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect.poll(() => fixture.writes('save').length).toBe(1)
    // Close trap cannot be bypassed by pointer; use the actual workspace control's change event.
    // The public control exercises useSwitchWorkspace + session invalidation, no store access.
    await page
      .locator('select[aria-label="Рабочее пространство"]')
      .filter({ visible: true })
      .selectOption(NOTIFICATIONS_OTHER_TENANT, { force: true })
    await expect(notificationEditor(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/radar$/)
    await page.getByRole('link', { name: 'Настройки', exact: true }).click()
    await page
      .getByRole('navigation', { name: 'Разделы настроек' })
      .getByRole('link', { name: 'Уведомления', exact: true })
      .click()
    await expect(page.getByText('Личные настройки · Другая студия', { exact: true })).toBeVisible()
    const oldResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith('/preferences/NO_RESPONSE'),
    )
    fixture.release('save')
    await oldResponse
    const newDialog = await openNotificationEditor(page)
    await expect(newDialog.locator('select[name=severity-NO_RESPONSE]')).toHaveValue('MEDIUM')
    expect(fixture.writes('save')).toHaveLength(1)
    expect(fixture.writes('save')[0]!.tenant).toBe(TENANT_ID)
    expect(fixture.otherRows[0]!.minimumSeverity).toBe('MEDIUM')
    expect(fixture.calls.filter((call) => call.endpoint === 'preferences').at(-1)!.tenant).toBe(
      NOTIFICATIONS_OTHER_TENANT,
    )
  } finally {
    fixture.dispose()
  }
})

test('R47 mode switches retain hidden values; DISABLED changes delivery without a risk lifecycle command', async ({
  page,
}) => {
  const fixture = await settingsNotificationsFixture(page)
  try {
    await page.goto('/settings/notifications')
    const dialog = await openNotificationEditor(page, 2)
    await expect(dialog.locator('input[name=digest-UNFINISHED_AGREEMENT]')).toHaveValue('09:00')
    await dialog.locator('input[name=digest-UNFINISHED_AGREEMENT]').fill('23:59')
    await dialog.locator('input[name=quiet-start-UNFINISHED_AGREEMENT]').fill('21:00')
    await dialog.locator('select[name=mode-UNFINISHED_AGREEMENT]').selectOption('DISABLED')
    await expect(dialog.locator('input[name=telegram-UNFINISHED_AGREEMENT]')).toBeDisabled()
    await expect(dialog.locator('select[name=severity-UNFINISHED_AGREEMENT]')).toBeDisabled()
    await dialog.locator('select[name=mode-UNFINISHED_AGREEMENT]').selectOption('IMMEDIATE')
    await expect(dialog.locator('input[name=digest-UNFINISHED_AGREEMENT]')).toHaveCount(0)
    await dialog.locator('select[name=mode-UNFINISHED_AGREEMENT]').selectOption('DIGEST')
    await expect(dialog.locator('input[name=digest-UNFINISHED_AGREEMENT]')).toHaveValue('23:59')
    await expect(dialog.locator('input[name=quiet-start-UNFINISHED_AGREEMENT]')).toHaveValue(
      '21:00',
    )
    await dialog.locator('select[name=mode-UNFINISHED_AGREEMENT]').selectOption('DISABLED')
    const nonNotificationCommands: string[] = []
    page.on('request', (request) => {
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
        !request.url().includes('/notifications/')
      )
        nonNotificationCommands.push(request.url())
    })
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Настройка сохранена' }),
    ).toBeVisible()
    expect(fixture.writes('save')[0]!.body).toEqual({
      deliveryMode: 'DISABLED',
      minimumSeverity: 'HIGH',
      inAppEnabled: true,
      telegramEnabled: true,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      digestTime: '23:59',
    })
    expect(nonNotificationCommands).toEqual([])
  } finally {
    fixture.dispose()
  }
})

test('R47 missing server rule stays absent instead of inventing a default', async ({ page }) => {
  const fixture = await settingsNotificationsFixture(page)
  fixture.rows.splice(2, 1)
  try {
    await page.goto('/settings/notifications')
    await expect(page.getByText('Получены не все правила', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Изменить:/ })).toHaveCount(5)
    await expect(
      page.getByRole('button', { name: 'Изменить: Договорённость требует внимания', exact: true }),
    ).toHaveCount(0)
    expect(fixture.writes()).toHaveLength(0)
  } finally {
    fixture.dispose()
  }
})

test('R47 late Telegram issuance after tenant switch cannot reopen an old token or start its polling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const fixture = await settingsNotificationsFixture(page, { linked: false, multiTenant: true })
  await page.clock.install({ time: new Date(NOTIFICATIONS_NOW) })
  await page.clock.pauseAt(new Date(NOTIFICATIONS_NOW))
  try {
    await page.goto('/settings/notifications')
    fixture.hold('issue')
    await page.getByRole('button', { name: 'Подключить Telegram', exact: true }).click()
    await expect.poll(() => fixture.writes('issue').length).toBe(1)
    await page
      .locator('select[aria-label="Рабочее пространство"]')
      .filter({ visible: true })
      .selectOption(NOTIFICATIONS_OTHER_TENANT, { force: true })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/radar$/)
    await page.getByRole('link', { name: 'Настройки', exact: true }).click()
    await page
      .getByRole('navigation', { name: 'Разделы настроек' })
      .getByRole('link', { name: 'Уведомления', exact: true })
      .click()
    await expect(page.getByText('Личные настройки · Другая студия', { exact: true })).toBeVisible()
    const issued = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/telegram-link-token'),
    )
    fixture.release('issue')
    await issued
    const oldTenantReads = fixture.calls.filter(
      (call) => call.endpoint === 'status' && call.tenant === TENANT_ID,
    ).length
    await page.clock.runFor(30_000)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Открыть бота', exact: true })).toHaveCount(0)
    expect(
      fixture.calls.filter((call) => call.endpoint === 'status' && call.tenant === TENANT_ID),
    ).toHaveLength(oldTenantReads)
    expect(fixture.writes('issue')[0]!.tenant).toBe(TENANT_ID)
    fixture.telegram.startUrl = 'https://t.me/lidradar_fixture_bot?start=synthetic-new-tenant-link'
    await page.getByRole('button', { name: 'Подключить Telegram', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Открыть бота', exact: true })).toHaveAttribute(
      'href',
      fixture.telegram.startUrl,
    )
    expect(fixture.writes('issue')[1]!.tenant).toBe(NOTIFICATIONS_OTHER_TENANT)
  } finally {
    fixture.dispose()
  }
})
