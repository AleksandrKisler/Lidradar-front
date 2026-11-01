/** 47 real API/click states × 3 adaptives. No HTML injection or baseline updates. */
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  settingsTeamFixture,
  teamMember,
  teamInvitation,
  TEAM_NOW,
  type SettingsTeamFixture,
} from '../../tests/e2e/fixtures/settings-team'
type Source = {
  package: string
  adaptive: string
  group: string
  state: string
  nodeId: string
  name: string
  width: number
  height: number
  nativePng: { path: string; sha256: string; width: number; height: number }
}
const ROOT = 'artifacts/frontend-v2/settings-notifications-team/Codex-R1'
const OUT = resolve(process.env.TEAM_CAPTURE_OUT ?? `${ROOT}/team/browser`)
const sourcePath = `${ROOT}/sources/source-map.json`
const historicalSources = JSON.parse(readFileSync(sourcePath, 'utf8')).entries as Source[]
const correctedSources = JSON.parse(
  readFileSync(`${ROOT}/header-correction/source-map.json`, 'utf8'),
).entries as Source[]
const sources = historicalSources
  .filter((source) => source.package === 'team')
  .map((source) => {
    const corrected = correctedSources.find(
      (entry) => entry.package === 'team' && entry.nodeId === source.nodeId,
    )
    return {
      ...(corrected ?? source),
      nativePng: {
        ...(corrected ?? source).nativePng,
        path: resolve(
          ROOT,
          corrected ? 'header-correction' : 'sources',
          (corrected ?? source).nativePng.path,
        ),
      },
    }
  })
const run = process.env.TEAM_CAPTURE_RUN ?? `${process.pid}-${Date.now()}`
expect(sources).toHaveLength(141)
for (const source of sources)
  expect(
    createHash('sha256')
      .update(readFileSync(resolve(ROOT, 'sources', source.nativePng.path)))
      .digest('hex'),
  ).toBe(source.nativePng.sha256)
test.use({
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true }).filter({ visible: true })
const edit = (page: Page, name = 'Анна Смирнова') =>
  page
    .getByRole('button', { name: `Изменить доступ: ${name}`, exact: true })
    .filter({ visible: true })
async function openRole(page: Page, name = 'Анна Смирнова') {
  await edit(page, name).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
async function prepare(page: Page, fixture: SettingsTeamFixture, group: string, state: string) {
  const dialog = page.getByRole('dialog')
  if (group === 'main') {
    if (state === 'refresh-error') {
      fixture.failures.set('members', { status: 500, code: 'INTERNAL_ERROR' })
      // Reconcile a failed background read without changing any member's role.
      await page.clock.setFixedTime(new Date(new Date(TEAM_NOW).getTime() + 31_000))
      await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.endsWith('/organization/members') &&
            response.request().method() === 'GET',
        ),
        page.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))),
      ])
      await expect(page.getByText('! Не удалось обновить команду', { exact: true })).toBeVisible()
      expect(fixture.writes()).toHaveLength(0)
      await page.clock.setFixedTime(new Date(TEAM_NOW))
    }
    if (state === 'member-updated') {
      await openRole(page)
      await dialog.locator('input[value=OWNER]').check()
      await button(page, 'Сохранить роль').click()
      await button(page, 'Готово').click()
    }
    if (state === 'member-revoked') {
      await openRole(page)
      await button(page, 'Отозвать доступ...').click()
      await button(page, 'Отозвать доступ').click()
      await expect(dialog).toHaveCount(0)
    }
    if (state === 'invite-revoked') {
      await button(page, 'Отозвать приглашение: Для менеджера вечерней смены').click()
      await button(page, 'Отозвать приглашение').click()
      await expect(dialog).toHaveCount(0)
    }
    if (state === 'invite-created' || state === 'invite-created-owner') {
      await button(page, 'Пригласить участника').click()
      await dialog.locator('textarea').fill('Для нового коллеги')
      if (state.endsWith('owner')) await dialog.locator('input[value=OWNER]').check()
      await button(page, 'Создать приглашение').click()
      await button(page, 'Готово').click()
    }
    return
  }
  const kind = group === 'openDialogs' ? state : group
  if (kind === 'invite') {
    await button(page, 'Пригласить участника').click()
    await expect(dialog).toBeVisible()
    await dialog.locator('textarea').fill('Для нового коллеги')
    if (state.includes('owner') || state === 'owner')
      await dialog.locator('input[value=OWNER]').check()
    if (state === 'validation') {
      await dialog.locator('textarea').evaluate((element: HTMLTextAreaElement) => {
        element.value = 'x'.repeat(501)
        element.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await button(page, 'Создать приглашение').click()
      await expect(dialog.getByText(/не длиннее 500/)).toBeVisible()
    }
    if (
      [
        'saving',
        'owner-saving',
        'created',
        'owner-created',
        'copied',
        'owner-copied',
        'copy-error',
        'error',
      ].includes(state)
    ) {
      if (state.includes('saving')) fixture.hold('create')
      if (state === 'error')
        fixture.failures.set('create', { status: 400, code: 'INVALID_ARGUMENT' })
      await button(page, 'Создать приглашение').click()
      if (state.includes('saving')) await expect(button(page, 'Создаём…')).toBeDisabled()
      else if (state === 'error') await expect(dialog.getByRole('alert')).toBeVisible()
      else {
        await expect(dialog.getByTestId('invitation-code')).toBeVisible()
        if (state.includes('copied') || state === 'copy-error') {
          await page.evaluate(
            (fail) =>
              Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {
                  writeText: () => (fail ? Promise.reject(new Error('denied')) : Promise.resolve()),
                },
              }),
            state === 'copy-error',
          )
          await button(page, 'Скопировать код').click()
          await expect(
            dialog.getByText(
              state === 'copy-error' ? 'Не удалось скопировать код' : 'Код скопирован',
              { exact: true },
            ),
          ).toBeVisible()
        }
      }
    }
  } else if (kind === 'role') {
    await openRole(
      page,
      state.startsWith('self-') || state === 'last-owner' ? 'Мария Белова' : 'Анна Смирнова',
    )
    if (state === 'last-owner') {
      // The approved protected form is a read reconciliation, not a failed demotion.
      // A second owner loses their role in a concurrent session; browser focus refetches GET.
      fixture.members[1]!.role = 'MANAGER'
      await page.clock.setFixedTime(new Date(new Date(TEAM_NOW).getTime() + 31_000))
      await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.endsWith('/organization/members') &&
            response.request().method() === 'GET',
        ),
        page.evaluate(() => window.dispatchEvent(new Event('visibilitychange'))),
      ])
      await expect(dialog.locator('input[value=OWNER]')).toBeChecked()
      await expect(dialog.locator('input[value=OWNER]')).toBeDisabled()
      await expect(button(page, 'Сохранить роль')).toBeDisabled()
      await page.clock.setFixedTime(new Date(TEAM_NOW))
      return
    }
    if (state !== 'form' && state !== 'role' && state !== 'self-edit')
      await dialog
        .locator(
          `input[value=${state === 'last-owner' || state === 'self-demotion' ? 'MANAGER' : 'OWNER'}]`,
        )
        .check()
    if (['saving', 'saved', 'error', 'last-owner', 'self-demotion'].includes(state)) {
      if (state === 'saving') fixture.hold('role')
      if (state === 'error') fixture.failures.set('role', { status: 400, code: 'INVALID_ARGUMENT' })
      if (state === 'last-owner') fixture.failures.set('role', { status: 409, code: 'LAST_OWNER' })
      await button(page, 'Сохранить роль').click()
      if (state === 'last-owner') await button(page, 'Стать менеджером').click()
      if (state === 'saved') await expect(dialog.getByRole('status')).toContainText('Роль изменена')
      if (state === 'saving') await expect(button(page, 'Сохраняем…')).toBeDisabled()
      if (state === 'error' || state === 'last-owner')
        await expect(dialog.getByRole('alert')).toBeVisible()
    }
  } else if (kind === 'revokeMember') {
    await openRole(page, state === 'self-removal' ? 'Мария Белова' : 'Анна Смирнова')
    await button(page, 'Отозвать доступ...').click()
    if (state === 'saving' || state === 'error') {
      if (state === 'saving') fixture.hold('revokeMember')
      else fixture.failures.set('revokeMember', { status: 400, code: 'INVALID_ARGUMENT' })
      await button(page, 'Отозвать доступ').click()
      if (state === 'saving') await expect(button(page, 'Отзываем…')).toBeDisabled()
      else await expect(dialog.getByRole('alert')).toBeVisible()
    }
  } else if (kind === 'revokeInvitation') {
    await button(page, 'Отозвать приглашение: Для менеджера вечерней смены').click()
    if (['saving', 'error', 'used'].includes(state)) {
      if (state === 'saving') fixture.hold('revokeInvitation')
      else
        fixture.failures.set('revokeInvitation', {
          status: state === 'used' ? 409 : 400,
          code: state === 'used' ? 'INVITATION_USED' : 'INVALID_ARGUMENT',
        })
      await button(page, 'Отозвать приглашение').click()
      if (state === 'saving') await expect(button(page, 'Отзываем…')).toBeDisabled()
      else await expect(dialog.getByRole('alert')).toBeVisible()
    }
  }
  await expect(dialog).toBeVisible()
}
for (const source of sources)
  test(`${source.adaptive} ${source.group}.${source.state} ${source.nodeId}`, async ({
    page,
    browserName,
  }, info) => {
    const viewport =
      source.adaptive === 'desktop'
        ? { width: 1440, height: 1000 }
        : source.adaptive === 'tablet'
          ? { width: 834, height: 1194 }
          : { width: 390, height: 844 }
    await page.setViewportSize(viewport)
    const fixture = await settingsTeamFixture(page, { manager: source.state === 'limited' })
    const group = source.group,
      state = source.state
    if (state === 'loading') {
      fixture.hold('members')
      fixture.hold('invitations')
    }
    if (state === 'initial-error') {
      fixture.failures.set('members', { status: 500, code: 'INTERNAL_ERROR' })
      fixture.failures.set('invitations', { status: 500, code: 'INTERNAL_ERROR' })
    }
    if (state === 'invitations-error')
      fixture.failures.set('invitations', { status: 500, code: 'INTERNAL_ERROR' })
    if (state === 'minimal') {
      fixture.members.splice(1)
      fixture.invitations.splice(0)
    }
    if (state === 'no-pending') fixture.invitations.splice(0)
    if (state === 'history') {
      fixture.members.push({ ...teamMember(7, 'Сергей Фомин'), email: 'sergey.fomin@example.test' })
      Object.assign(fixture.invitations[0]!, {
        status: 'ACCEPTED',
        acceptedAt: TEAM_NOW,
        acceptedBy: fixture.members.at(-1)!.userId,
      })
      fixture.invitations.push(
        {
          ...teamInvitation(3, 'ACCEPTED'),
          note: 'Для старшего смены',
          createdAt: '2026-10-24T07:00:00Z',
          acceptedAt: '2026-10-30T08:45:00Z',
        },
        {
          ...teamInvitation(4, 'REVOKED'),
          note: 'Предыдущее приглашение',
          createdAt: '2026-10-23T07:00:00Z',
          revokedAt: '2026-10-31T08:45:00Z',
        },
      )
    }
    if (state === 'long-list')
      for (let i = 1; i <= 8; i++)
        fixture.members.push({
          ...teamMember(i + 6, `Сотрудник смены ${i}`),
          email: `shift.${i}@example.test`,
        })
    if (state === 'two-owners' || state.startsWith('self-') || state === 'last-owner')
      fixture.members[1]!.role = 'OWNER'
    try {
      await page.goto('/settings/team')
      if (state === 'limited')
        await expect(page.getByText('Раздел доступен владельцу', { exact: true })).toBeVisible()
      else {
        await expect(
          page.getByRole('heading', { name: 'Команда и доступ', exact: true }),
        ).toBeVisible()
        if (state !== 'loading' && state !== 'initial-error')
          await expect(page.getByText('Мария Белова · Вы', { exact: true })).toBeVisible()
        if (state === 'loading')
          await expect(page.getByRole('status', { name: 'Загрузка команды' })).toBeVisible()
        if (state === 'initial-error')
          await expect(
            page.getByText('Не удалось загрузить команду', { exact: true }),
          ).toBeVisible()
        if (state === 'invitations-error')
          await expect(
            page.getByText('! Не удалось загрузить приглашения', { exact: true }),
          ).toBeVisible()
        await prepare(page, fixture, group, state)
      }
      await page.mouse.move(0, 0)
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      })
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((image) => image.decode()))
        if (!document.fonts.check('16px Inter')) throw new Error('Inter unavailable')
      })
      const id = `${source.adaptive}-${source.nodeId.replace(':', '-')}`
      mkdirSync(OUT, { recursive: true })
      const files: { viewport: string; fullPage?: string; exact: string } = {
        viewport: `${id}-viewport.png`,
        exact: `${id}-exact.png`,
      }
      await page.screenshot({ path: `${OUT}/${files.viewport}`, animations: 'disabled' })
      if (group === 'main') {
        files.fullPage = `${id}-full.png`
        await page.screenshot({
          path: `${OUT}/${files.fullPage}`,
          fullPage: true,
          animations: 'disabled',
        })
        files.exact = files.fullPage
      } else if (group === 'openDialogs') files.exact = files.viewport
      else
        await page
          .getByRole('dialog')
          .screenshot({ path: `${OUT}/${files.exact}`, animations: 'disabled' })
      const geometry = await page.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        },
        elements: [...document.querySelectorAll('main,section,[role=dialog],button,img')]
          .filter((el) => el.getClientRects().length)
          .map((el) => {
            const rect = el.getBoundingClientRect()
            return {
              tag: el.tagName,
              name: el.getAttribute('aria-label'),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }
          }),
      }))
      expect(geometry.document.width).toBeLessThanOrEqual(viewport.width)
      const sha256 = Object.fromEntries(
        Object.values(files).map((file) => [
          file,
          createHash('sha256')
            .update(readFileSync(`${OUT}/${file}`))
            .digest('hex'),
        ]),
      )
      mkdirSync(`${OUT}/records`, { recursive: true })
      writeFileSync(
        `${OUT}/records/${id}.json`,
        JSON.stringify(
          {
            id,
            run,
            nodeId: source.nodeId,
            adaptive: source.adaptive,
            group,
            state,
            referenceKind: 'exact-frame',
            reference: source.nativePng,
            files,
            sha256,
            viewport,
            browser: browserName,
            browserVersion: page.context().browser()?.version(),
            project: info.project.name,
            clock: TEAM_NOW,
            fixture: 'settingsTeamFixture',
            calls: fixture.calls,
            geometry,
          },
          null,
          2,
        ),
      )
    } finally {
      fixture.dispose()
    }
  })
test.afterAll(() => {
  mkdirSync(OUT, { recursive: true })
  const records = sources.map((source) => {
    const id = `${source.adaptive}-${source.nodeId.replace(':', '-')}`,
      path = `${OUT}/records/${id}.json`,
      saved = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null
    return saved?.run === run
      ? saved
      : { id, result: 'UNVERIFIED', reason: 'No capture from current run' }
  })
  writeFileSync(`${OUT}/source-map.json`, JSON.stringify(records, null, 2))
  expect(records.filter((record) => record.run === run)).toHaveLength(141)
})
