import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fetchMe, useSessionStore, type AuthMeResponse } from '@/entities/session'
import {
  AccountDeletionBanner,
  AccountDeletionCard,
  ExportAccountDataCard,
  PasswordConfirmDialog,
} from '@/features/auth-session'
import { ExportOrganizationCard } from '@/features/manage-consent'
import { ApiError } from '@/shared/api'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

/**
 * Выгрузка личных данных и закрытие аккаунта (ADR 0059): диалог подтверждения паролем, карточки, баннер и
 * выгрузка организации. Запросы идут через настоящий клиент с подменённым `fetch`, поэтому проверяются метод,
 * путь, тело и заголовки.
 */

const PASSWORD = 'very-secure-password'
const DUE = '2026-11-13T09:00:00Z'

function meResponse(
  deletionDueAt: string | null,
  role: 'OWNER' | 'MANAGER' = 'OWNER',
): AuthMeResponse {
  return {
    canCreateOrganization: false,
    user: {
      id: 'u-1',
      email: 'owner@example.test',
      displayName: 'Мария',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      emailVerifiedAt: '2026-10-02T00:00:00Z',
      deletionDueAt,
    },
    memberships: [{ tenantId: 'tenant-a', organizationName: 'Салон', role }],
  }
}

function errorResponse(
  status: number,
  code: string,
  extra: { details?: unknown; headers?: Record<string, string> } = {},
): Response {
  return Response.json(
    { error: { code, message: 'server text', traceId: 'trace-1', details: extra.details } },
    { status, ...(extra.headers ? { headers: extra.headers } : {}) },
  )
}

function fileResponse(name: string, type: string, content = 'content'): Response {
  return new Response(content, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"` },
  })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

const body = () => new DOMWrapper(document.body)
const dialog = () => body().get('[role="dialog"]')
const buttonNamed = (
  root: { findAll: (selector: string) => DOMWrapper<Element>[] },
  text: string,
): DOMWrapper<Element> => root.findAll('button').find((button) => button.text().startsWith(text))!

let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
let downloads: { download: string; href: string }[]
const createObjectURL = vi.fn<(blob: Blob) => string>()

function requestsTo(method: string, pathname: string): Request[] {
  return fetchMock.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === method && new URL(request.url).pathname === pathname)
}

async function readJson(request: Request): Promise<unknown> {
  return JSON.parse(await request.clone().text())
}

beforeEach(async () => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  vi.mocked(fetchMe).mockReset().mockResolvedValue(meResponse(null))
  await useSessionStore().bootstrap()
  useSessionStore().selectTenant('tenant-a')
  fetchMock = vi.fn<(request: Request) => Promise<Response>>()
  vi.stubGlobal('fetch', fetchMock)
  downloads = []
  createObjectURL.mockReset().mockReturnValue('blob:lidradar')
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ download: this.download, href: this.href })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function submitPassword(password: string): Promise<void> {
  await body().get('input[name="confirm-password"]').setValue(password)
  await body().get('form').trigger('submit')
  await settle()
}

describe('PasswordConfirmDialog', () => {
  function mountDialog(action: (password: string) => Promise<void>, extra: object = {}) {
    return mount(PasswordConfirmDialog, {
      props: {
        open: true,
        title: 'Подтвердите',
        confirmLabel: 'Подтвердить',
        retryKey: 'test.confirm.retry',
        action,
        ...extra,
      },
      attachTo: document.body,
    })
  }

  it('не вызывает действие с пустым паролем и объясняет почему', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog(action)
    await flushPromises()
    await body().get('form').trigger('submit')
    await settle()
    expect(action).not.toHaveBeenCalled()
    expect(dialog().text()).toContain('Введите текущий пароль')
    wrapper.unmount()
  })

  it('успех закрывает окно, сообщает о результате и не хранит пароль', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const wrapper = mountDialog(action)
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(action).toHaveBeenCalledWith(PASSWORD)
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect((body().get('input[name="confirm-password"]').element as HTMLInputElement).value).toBe(
      '',
    )
    wrapper.unmount()
  })

  it('неверный пароль — ошибка у поля, окно остаётся, это не потеря сессии', async () => {
    const action = vi
      .fn()
      .mockRejectedValue(new ApiError({ httpStatus: 403, code: 'INVALID_CURRENT_PASSWORD' }))
    const wrapper = mountDialog(action)
    await flushPromises()
    await submitPassword('wrong-password-value')
    expect(dialog().text()).toContain('Пароль не подошёл')
    expect(wrapper.emitted('done')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })

  it('после предела показывает отсчёт и не шлёт повторный запрос', async () => {
    const action = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ httpStatus: 429, code: 'RATE_LIMITED', retryAfterSeconds: 600 }),
      )
    const wrapper = mountDialog(action)
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(dialog().text()).toContain('Слишком много попыток')
    expect(dialog().text()).toContain('10 мин')
    const confirm = buttonNamed(dialog(), 'Повторить через')
    expect(confirm.attributes('disabled')).toBeDefined()
    await body().get('form').trigger('submit')
    await settle()
    expect(action).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('остальные ошибки объясняются по коду, а своё объяснение подменяет обычное', async () => {
    const action = vi
      .fn()
      .mockRejectedValue(new ApiError({ httpStatus: 500, code: 'INTERNAL_ERROR' }))
    const plain = mountDialog(action)
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(dialog().text()).toContain('Внутренняя ошибка сервера')
    plain.unmount()
    document.body.innerHTML = ''

    const custom = mountDialog(action, {
      explain: () => ({
        tone: 'warning',
        title: 'Своё объяснение',
        text: 'Текст',
        lines: ['Первая', 'Вторая'],
      }),
    })
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(dialog().text()).toContain('Своё объяснение')
    expect(
      dialog()
        .findAll('li')
        .map((item) => item.text()),
    ).toEqual(['Первая', 'Вторая'])
    custom.unmount()
  })
})

describe('ExportAccountDataCard', () => {
  it('скачивает файл по паролю: запрос с телом, файл под предложенным именем, сообщение об успехе', async () => {
    fetchMock.mockResolvedValue(fileResponse('lidradar-account-20261014.json', 'application/json'))
    const wrapper = mount(ExportAccountDataCard, { attachTo: document.body })
    expect(wrapper.text()).toContain('Не входят: пароль и его хэш')
    await wrapper.get('[data-testid="export-account-open"]').trigger('click')
    await flushPromises()
    await submitPassword(PASSWORD)

    const [request] = requestsTo('POST', '/api/v1/auth/account/export')
    expect(request).toBeDefined()
    expect(await readJson(request!)).toEqual({ password: PASSWORD })
    expect(downloads).toEqual([
      { download: 'lidradar-account-20261014.json', href: 'blob:lidradar' },
    ])
    expect(wrapper.get('[data-testid="export-account-saved"]').text()).toContain(
      'lidradar-account-20261014.json',
    )
    expect(body().find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('неверный пароль не скачивает файл и оставляет окно для повтора', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'INVALID_CURRENT_PASSWORD'))
    const wrapper = mount(ExportAccountDataCard, { attachTo: document.body })
    await wrapper.get('[data-testid="export-account-open"]').trigger('click')
    await flushPromises()
    await submitPassword('wrong-password-value')
    expect(dialog().text()).toContain('Пароль не подошёл')
    expect(downloads).toHaveLength(0)
    expect(wrapper.find('[data-testid="export-account-saved"]').exists()).toBe(false)
    expect(useSessionStore().isAuthenticated).toBe(true)
    wrapper.unmount()
  })

  it('имя файла от сервера не может выйти из каталога загрузок', async () => {
    fetchMock.mockResolvedValue(fileResponse('../../etc/passwd', 'application/json'))
    const wrapper = mount(ExportAccountDataCard, { attachTo: document.body })
    await wrapper.get('[data-testid="export-account-open"]').trigger('click')
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(downloads).toEqual([{ download: 'lidradar-account.json', href: 'blob:lidradar' }])
    wrapper.unmount()
  })

  it('очищает имя файла: пробелы и скобки заменяются, буквы и точки остаются', async () => {
    fetchMock.mockResolvedValue(fileResponse('my data <1>.json', 'application/json'))
    const wrapper = mount(ExportAccountDataCard, { attachTo: document.body })
    await wrapper.get('[data-testid="export-account-open"]').trigger('click')
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(downloads).toEqual([{ download: 'my_data_1_.json', href: 'blob:lidradar' }])
    wrapper.unmount()
  })
})

describe('AccountDeletionCard', () => {
  it('объясняет последствия и просит пароль; запрос назначает срок, карточка показывает его', async () => {
    fetchMock.mockResolvedValue(Response.json({ deletionDueAt: DUE }))
    const wrapper = mount(AccountDeletionCard, { attachTo: document.body })
    expect(wrapper.text()).toContain('Через 30 суток')
    expect(wrapper.text()).toContain('Единственный владелец организации сначала передаёт владение')
    expect(wrapper.find('[data-testid="deletion-scheduled"]').exists()).toBe(false)

    await wrapper.get('[data-testid="deletion-open"]').trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('Удалить аккаунт?')
    vi.mocked(fetchMe).mockResolvedValue(meResponse(DUE))
    await submitPassword(PASSWORD)

    const [request] = requestsTo('POST', '/api/v1/auth/account/deletion')
    expect(await readJson(request!)).toEqual({ password: PASSWORD })
    const scheduled = wrapper.get('[data-testid="deletion-scheduled"]')
    expect(scheduled.text()).toContain('13 ноября 2026, 09:00 (UTC)')
    expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('причины блокировки показываются списком вместо общей ошибки, срок не назначается', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(409, 'ACCOUNT_DELETION_BLOCKED', {
        details: {
          blockers: [
            { code: 'SOLE_OWNER', organizationName: 'Салон Лотос', hasOtherMembers: true },
            { code: 'SOLE_OWNER', organizationName: 'Одиночка', hasOtherMembers: false },
            { code: 'PLATFORM_ADMIN' },
            { code: 'UNKNOWN_FUTURE_CODE' },
          ],
        },
      }),
    )
    const wrapper = mount(AccountDeletionCard, { attachTo: document.body })
    await wrapper.get('[data-testid="deletion-open"]').trigger('click')
    await flushPromises()
    await submitPassword(PASSWORD)

    const failure = dialog().get('[data-testid="confirm-failure"]')
    expect(failure.text()).toContain('Аккаунт пока нельзя удалить')
    const lines = failure.findAll('li').map((item) => item.text())
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe(
      'Вы единственный владелец организации «Салон Лотос». Передайте владение другому участнику в «Настройки → Команда».',
    )
    expect(lines[1]).toContain('единственный участник организации «Одиночка»')
    expect(lines[1]).toContain('поддержка LidRadar')
    expect(lines[2]).toContain('администратора платформы')
    expect(wrapper.find('[data-testid="deletion-scheduled"]').exists()).toBe(false)
    expect(fetchMe).toHaveBeenCalledTimes(1) // запрос отклонён: состояние сессии не перечитывалось
    wrapper.unmount()
  })

  it('название организации выводится текстом, а не разметкой', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(409, 'ACCOUNT_DELETION_BLOCKED', {
        details: {
          blockers: [
            {
              code: 'SOLE_OWNER',
              organizationName: '<img src=x onerror=alert(1)>',
              hasOtherMembers: true,
            },
          ],
        },
      }),
    )
    const wrapper = mount(AccountDeletionCard, { attachTo: document.body })
    await wrapper.get('[data-testid="deletion-open"]').trigger('click')
    await flushPromises()
    await submitPassword(PASSWORD)
    expect(dialog().find('img').exists()).toBe(false)
    expect(dialog().text()).toContain('<img src=x onerror=alert(1)>')
    wrapper.unmount()
  })

  it('при назначенном удалении предлагает отмену; после отмены возвращает исходный вид', async () => {
    vi.mocked(fetchMe).mockResolvedValue(meResponse(DUE))
    await useSessionStore().refresh()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const wrapper = mount(AccountDeletionCard, { attachTo: document.body })
    expect(wrapper.get('[data-testid="deletion-scheduled"]').text()).toContain('Удаление назначено')
    expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(false)

    vi.mocked(fetchMe).mockResolvedValue(meResponse(null))
    await wrapper.get('[data-testid="deletion-cancel"]').trigger('click')
    await settle()
    expect(requestsTo('DELETE', '/api/v1/auth/account/deletion')).toHaveLength(1)
    expect(wrapper.find('[data-testid="deletion-scheduled"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="deletion-open"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('ошибка отмены показывается и оставляет назначение на месте', async () => {
    vi.mocked(fetchMe).mockResolvedValue(meResponse(DUE))
    await useSessionStore().refresh()
    fetchMock.mockResolvedValue(
      errorResponse(429, 'RATE_LIMITED', { headers: { 'Retry-After': '3600' } }),
    )
    const wrapper = mount(AccountDeletionCard, { attachTo: document.body })
    await wrapper.get('[data-testid="deletion-cancel"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="deletion-cancel-error"]').text()).toContain(
      'Слишком много попыток',
    )
    expect(wrapper.find('[data-testid="deletion-scheduled"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('AccountDeletionBanner', () => {
  it('скрыт без назначения', () => {
    const wrapper = mount(AccountDeletionBanner)
    expect(wrapper.find('[data-testid="account-deletion-banner"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('показывает срок и отменяет удаление одним нажатием; скрыть его нельзя', async () => {
    vi.mocked(fetchMe).mockResolvedValue(meResponse(DUE))
    await useSessionStore().refresh()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const wrapper = mount(AccountDeletionBanner)
    const banner = wrapper.get('[data-testid="account-deletion-banner"]')
    expect(banner.text()).toContain('13 ноября 2026, 09:00 (UTC)')
    expect(banner.text()).toContain('всё работает как обычно')
    expect(banner.findAll('button').map((button) => button.text())).toEqual(['Отменить удаление'])

    vi.mocked(fetchMe).mockResolvedValue(meResponse(null))
    await wrapper.get('[data-testid="account-deletion-banner-cancel"]').trigger('click')
    await settle()
    expect(requestsTo('DELETE', '/api/v1/auth/account/deletion')).toHaveLength(1)
    expect(wrapper.find('[data-testid="account-deletion-banner"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ошибка отмены остаётся на виду, баннер не исчезает', async () => {
    vi.mocked(fetchMe).mockResolvedValue(meResponse(DUE))
    await useSessionStore().refresh()
    fetchMock.mockResolvedValue(errorResponse(500, 'INTERNAL_ERROR'))
    const wrapper = mount(AccountDeletionBanner)
    await wrapper.get('[data-testid="account-deletion-banner-cancel"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="account-deletion-banner-error"]').text()).toContain(
      'Внутренняя ошибка сервера',
    )
    expect(wrapper.find('[data-testid="account-deletion-banner"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('ExportOrganizationCard', () => {
  it('скачивает архив организации: POST с X-Tenant-ID без тела, файл под именем сервера', async () => {
    fetchMock.mockResolvedValue(
      fileResponse('lidradar-organization-20261014.zip', 'application/zip', 'x'.repeat(2048)),
    )
    const wrapper = mount(ExportOrganizationCard, { props: { tenantId: 'tenant-a' } })
    expect(wrapper.text()).toContain('Не входят: ключи и секреты')
    expect(wrapper.text()).toContain('Не чаще трёх раз в час')
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await settle()

    const [request] = requestsTo('POST', '/api/v1/organization/export')
    expect(request!.headers.get('X-Tenant-ID')).toBe('tenant-a')
    expect(await request!.clone().text()).toBe('')
    expect(downloads).toEqual([
      { download: 'lidradar-organization-20261014.zip', href: 'blob:lidradar' },
    ])
    const saved = wrapper.get('[data-testid="export-organization-saved"]')
    expect(saved.text()).toContain('lidradar-organization-20261014.zip')
    expect(saved.text()).toContain('2\u00a0КБ')
    expect(saved.text()).toContain('manifest.json')
    wrapper.unmount()
  })

  it('очищает имя архива, присланное сервером, перед сохранением', async () => {
    fetchMock.mockResolvedValue(fileResponse('Salon export <1>.zip', 'application/zip'))
    const wrapper = mount(ExportOrganizationCard, { props: { tenantId: 'tenant-a' } })
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await settle()
    expect(downloads).toEqual([{ download: 'Salon_export_1_.zip', href: 'blob:lidradar' }])
    expect(wrapper.get('[data-testid="export-organization-saved"]').text()).toContain(
      'Salon_export_1_.zip',
    )
    wrapper.unmount()
  })

  it('пока архив готовится, кнопка занята и повторный запрос не уходит', async () => {
    let release: (response: Response) => void = () => undefined
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)))
    const wrapper = mount(ExportOrganizationCard, { props: { tenantId: 'tenant-a' } })
    const button = wrapper.get('[data-testid="export-organization"]')
    await button.trigger('click')
    await flushPromises()
    expect(button.text()).toContain('Готовим архив…')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    release(fileResponse('a.zip', 'application/zip'))
    await settle()
    expect(button.text()).toBe('Скачать архив')
    wrapper.unmount()
  })

  it('предел и занятость показывают срок повтора, нехватка права — обычное объяснение', async () => {
    const wrapper = mount(ExportOrganizationCard, { props: { tenantId: 'tenant-a' } })
    fetchMock.mockResolvedValueOnce(
      errorResponse(429, 'RATE_LIMITED', { headers: { 'Retry-After': '2460' } }),
    )
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).toContain(
      'Слишком много попыток',
    )
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).toContain(
      'Повторите через 41 мин',
    )

    fetchMock.mockResolvedValueOnce(
      errorResponse(429, 'EXPORT_BUSY', { headers: { 'Retry-After': '30' } }),
    )
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).toContain(
      'Выгрузка уже выполняется',
    )
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).toContain('30 с')

    fetchMock.mockResolvedValueOnce(errorResponse(403, 'FORBIDDEN'))
    await wrapper.get('[data-testid="export-organization"]').trigger('click')
    await settle()
    expect(wrapper.get('[data-testid="export-organization-error"]').text()).toContain(
      'Раздел недоступен',
    )
    expect(downloads).toHaveLength(0)
    expect(wrapper.find('[data-testid="export-organization-saved"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
