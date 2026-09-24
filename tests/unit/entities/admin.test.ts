import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adminKeys,
  adminStatusLabel,
  adminStatusTone,
  deadLetterKindLabel,
  defaultUsageRange,
  discardDelivery,
  fetchAdminJobs,
  fetchAdminMe,
  fetchTrace,
  grantPlatformAdmin,
  isUuid,
  recoveryActionLabel,
  retryJob,
  safeJson,
  shortId,
  usageRangeToInstants,
  validateUsageRange,
} from '@/entities/admin'

describe('подписи и безопасный показ', () => {
  it('переводит известные статусы, неизвестные оставляет как есть с нейтральным тоном', () => {
    expect(adminStatusLabel('DEAD')).toBe('Мёртвое')
    expect(adminStatusTone('DEAD')).toBe('danger')
    expect(adminStatusLabel('APPLIED')).toBe('Применён')
    expect(adminStatusLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(adminStatusTone('SOMETHING_NEW')).toBe('neutral')
    expect(deadLetterKindLabel('aiJob')).toBe('AI-задание')
    expect(recoveryActionLabel('replay')).toBe('Переотправить')
  })

  it('сокращает идентификаторы и ограничивает JSON-значения фактов', () => {
    expect(shortId('01990000-0000-7000-8000-000000000301')).toBe('01990000…')
    expect(shortId('short')).toBe('short')
    expect(shortId(null)).toBe('—')
    expect(safeJson({ price: 3500, note: 'x' })).toBe('{"price":3500,"note":"x"}')
    expect(safeJson('<img src=x onerror=alert(1)>')).toBe('"<img src=x onerror=alert(1)>"')
    // Управляющие символы (NUL, BEL) не доходят до разметки: JSON их экранирует,
    // а нестрокового пути они заменяются пробелом.
    const control = `a${String.fromCharCode(0)}b${String.fromCharCode(7)}c`
    const shown = safeJson(control)
    expect(shown.startsWith('"a')).toBe(true)
    expect([...shown].every((char) => char.charCodeAt(0) >= 32)).toBe(true)
    expect(safeJson('x'.repeat(500), 50)).toHaveLength(50)
    expect(safeJson('x'.repeat(500), 50).endsWith('…')).toBe(true)
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(safeJson(circular)).toBe('[несериализуемое значение]')
    expect(safeJson(undefined)).toBe('undefined')
    expect(isUuid('01990000-0000-7000-8000-000000000301')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })

  it('окно потребления: 30 дней по умолчанию, предел 366, границы UTC', () => {
    const now = new Date('2026-09-24T10:00:00Z')
    expect(defaultUsageRange(now)).toEqual({ from: '2026-08-26', to: '2026-09-24' })
    expect(validateUsageRange({ from: '2026-09-01', to: '2026-09-24' })).toBeNull()
    expect(validateUsageRange({ from: '2026-09-25', to: '2026-09-24' })).toBe(
      'Дата начала позже даты окончания',
    )
    expect(validateUsageRange({ from: '2025-09-23', to: '2026-09-24' })).toBe(
      'Окно не длиннее 366 дней',
    )
    expect(validateUsageRange({ from: '', to: '2026-09-24' })).toContain('ГГГГ-ММ-ДД')
    expect(usageRangeToInstants({ from: '2026-09-01', to: '2026-09-24' })).toEqual({
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-25T00:00:00.000Z',
    })
  })
})

describe('запросы администратора', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ключи не входят в область организации и нормализуют фильтры', () => {
    expect(adminKeys.me()).toEqual(['admin', 'me'])
    expect(adminKeys.jobs({ status: 'DEAD', tenantId: undefined, limit: 50 })).toEqual([
      'admin',
      'jobs',
      { limit: 50, status: 'DEAD' },
    ])
    expect(adminKeys.jobs({ limit: 50, status: 'DEAD' })).toEqual(
      adminKeys.jobs({ status: 'DEAD', limit: 50 }),
    )
  })

  it('запросы идут без заголовка организации, фильтры и лимит — в query', async () => {
    fetchMock.mockImplementation(async () =>
      respond({ items: [], userId: 'u', platformAdmin: true }),
    )
    await fetchAdminMe()
    const me = fetchMock.mock.calls[0]![0]
    expect(new URL(me.url).pathname).toBe('/api/v1/admin/me')
    expect(me.headers.get('X-Tenant-ID')).toBeNull()
    await fetchAdminJobs({ status: 'DEAD', tenantId: 't-1', limit: 100 })
    const jobs = new URL(fetchMock.mock.calls[1]![0].url)
    expect(jobs.pathname).toBe('/api/v1/admin/jobs')
    expect(jobs.searchParams.get('status')).toBe('DEAD')
    expect(jobs.searchParams.get('tenantId')).toBe('t-1')
    expect(jobs.searchParams.get('limit')).toBe('100')
    await fetchAdminJobs({})
    expect(new URL(fetchMock.mock.calls[2]![0].url).searchParams.get('limit')).toBe('50')
    await fetchTrace('t-1', 'm-1')
    expect(new URL(fetchMock.mock.calls[3]![0].url).pathname).toBe(
      '/api/v1/admin/trace/tenants/t-1/messages/m-1',
    )
  })

  it('выдача права различает 201 и 200; команды восстановления адресуют объект', async () => {
    const admin = {
      id: 'a-1',
      userId: 'u-2',
      email: 'x@y.z',
      grantedBy: 'u-1',
      grantedAt: '',
      note: '',
    }
    fetchMock
      .mockImplementationOnce(async () => respond(admin, 201))
      .mockImplementationOnce(async () => respond(admin, 200))
      .mockImplementationOnce(async () => respond({ id: 'j-1', status: 'PENDING' }))
      .mockImplementationOnce(async () => respond({ id: 'd-1', status: 'DEAD' }))
    expect(await grantPlatformAdmin({ email: 'x@y.z' })).toEqual({ admin, alreadyActive: false })
    expect(await grantPlatformAdmin({ email: 'x@y.z', note: 'дежурный' })).toEqual({
      admin,
      alreadyActive: true,
    })
    expect(await fetchMock.mock.calls[1]![0].json()).toEqual({ email: 'x@y.z', note: 'дежурный' })
    await retryJob('j-1')
    expect(new URL(fetchMock.mock.calls[2]![0].url).pathname).toBe('/api/v1/admin/jobs/j-1/retry')
    expect(fetchMock.mock.calls[2]![0].method).toBe('POST')
    await discardDelivery('d-1')
    expect(new URL(fetchMock.mock.calls[3]![0].url).pathname).toBe(
      '/api/v1/admin/notifications/deliveries/d-1/discard',
    )
  })
})
