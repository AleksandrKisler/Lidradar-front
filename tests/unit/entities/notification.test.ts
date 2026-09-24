import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deliveryModeDescription,
  deliveryModeLabel,
  describeQuietHours,
  draftFromPreference,
  fetchPreferences,
  isSafeStartUrl,
  issueTelegramLinkToken,
  notificationKeys,
  putPreference,
  resetPreference,
  samePreference,
  severityThresholdLabel,
  toPreferenceRequest,
  validateDraft,
  type NotificationPreference,
} from '@/entities/notification'

const preference: NotificationPreference = {
  riskType: 'NO_RESPONSE',
  minimumSeverity: 'MEDIUM',
  deliveryMode: 'IMMEDIATE',
  inAppEnabled: true,
  telegramEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  digestTime: '09:00',
  timezone: 'Europe/Moscow',
  isDefault: true,
}

describe('подписи уведомлений', () => {
  it('переводят режимы и пороги, неизвестное значение возвращают как есть', () => {
    expect(deliveryModeLabel('DIGEST')).toBe('Сводкой раз в день')
    expect(deliveryModeLabel('WEIRD')).toBe('WEIRD')
    expect(deliveryModeDescription('DISABLED')).toContain('Radar')
    expect(severityThresholdLabel('LOW')).toBe('Все риски')
    expect(severityThresholdLabel('CRITICAL')).toBe('Только критичные')
    expect(severityThresholdLabel('X')).toBe('X')
  })
})

describe('черновик настройки', () => {
  it('строится из ответа: пустые границы тихих часов становятся пустыми строками', () => {
    expect(draftFromPreference(preference)).toEqual({
      minimumSeverity: 'MEDIUM',
      deliveryMode: 'IMMEDIATE',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: false,
      quietHoursStart: '',
      quietHoursEnd: '',
      digestTime: '09:00',
    })
  })

  it('требует обе границы тихих часов и их различие, интервал через полночь допускает', () => {
    const base = draftFromPreference(preference)
    expect(validateDraft({ ...base, quietHoursEnabled: true })).toEqual({
      quietHoursStart: 'Укажите начало',
      quietHoursEnd: 'Укажите конец',
    })
    expect(
      validateDraft({
        ...base,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '22:00',
      }),
    ).toEqual({ quietHoursEnd: 'Границы тихих часов должны различаться' })
    expect(
      validateDraft({
        ...base,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }),
    ).toEqual({})
    expect(validateDraft({ ...base, quietHoursStart: 'мусор' })).toEqual({})
  })

  it('для сводки требует время, для остальных режимов — нет', () => {
    const base = draftFromPreference(preference)
    expect(validateDraft({ ...base, deliveryMode: 'DIGEST', digestTime: '' })).toEqual({
      digestTime: 'Укажите время сводки',
    })
    expect(validateDraft({ ...base, deliveryMode: 'DIGEST', digestTime: '24:00' })).toEqual({
      digestTime: 'Укажите время сводки',
    })
    expect(validateDraft({ ...base, deliveryMode: 'DIGEST', digestTime: '18:30' })).toEqual({})
    expect(validateDraft({ ...base, deliveryMode: 'DISABLED', digestTime: '' })).toEqual({})
  })

  it('собирает полное тело PUT и не отправляет границы выключенных тихих часов', () => {
    const base = draftFromPreference(preference)
    expect(
      toPreferenceRequest({ ...base, quietHoursStart: '22:00', quietHoursEnd: '07:00' }),
    ).toEqual({
      minimumSeverity: 'MEDIUM',
      deliveryMode: 'IMMEDIATE',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: false,
      digestTime: '09:00',
    })
    expect(
      toPreferenceRequest({
        ...base,
        deliveryMode: 'DIGEST',
        digestTime: '10:30',
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      }),
    ).toEqual({
      minimumSeverity: 'MEDIUM',
      deliveryMode: 'DIGEST',
      inAppEnabled: true,
      telegramEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      digestTime: '10:30',
    })
    expect(toPreferenceRequest({ ...base, digestTime: '' }).digestTime).toBe('09:00')
  })

  it('подписывает интервал и помечает переход через полночь', () => {
    expect(describeQuietHours('13:00', '14:00')).toBe('13:00–14:00')
    expect(describeQuietHours('22:00', '07:00')).toBe('22:00–07:00, через полночь')
  })

  it('различает настройку, изменённую на сервере, и ту же настройку из перечитанного списка', () => {
    expect(samePreference(preference, { ...preference })).toBe(true)
    expect(samePreference(preference, { ...preference, isDefault: false })).toBe(false)
    expect(samePreference(preference, { ...preference, updatedAt: '2026-09-24T10:00:00Z' })).toBe(
      false,
    )
    expect(samePreference(preference, { ...preference, telegramEnabled: true })).toBe(false)
  })
})

describe('ссылка привязки', () => {
  it('допускает только схемы Telegram', () => {
    expect(isSafeStartUrl('https://t.me/lidradar_bot?start=abc')).toBe(true)
    expect(isSafeStartUrl('tg://resolve?domain=lidradar_bot&start=abc')).toBe(true)
    expect(isSafeStartUrl('http://t.me/lidradar_bot')).toBe(false)
    expect(isSafeStartUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeStartUrl('не ссылка')).toBe(false)
  })
})

describe('запросы уведомлений', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  const respond = (body: unknown, status = 200) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ключи лежат в области организации', () => {
    expect(notificationKeys.link('t-1')).toEqual(['tenant', 't-1', 'telegram-link'])
    expect(notificationKeys.preferences('t-1')).toEqual([
      'tenant',
      't-1',
      'notification-preferences',
    ])
  })

  it('выпуск ссылки — POST без тела с заголовком организации', async () => {
    fetchMock.mockResolvedValue(
      respond({ startUrl: 'https://t.me/bot?start=x', expiresAt: '2026-09-24T10:15:00Z' }, 201),
    )
    const token = await issueTelegramLinkToken('t-1')
    const request = fetchMock.mock.calls[0]![0]
    expect(request.method).toBe('POST')
    expect(new URL(request.url).pathname).toBe('/api/v1/notifications/telegram-link-token')
    expect(request.headers.get('X-Tenant-ID')).toBe('t-1')
    expect(token.startUrl).toBe('https://t.me/bot?start=x')
  })

  it('список настроек разворачивается из items, PUT и DELETE адресуют тип риска', async () => {
    fetchMock
      .mockResolvedValueOnce(respond({ items: [preference] }))
      .mockResolvedValueOnce(respond({ ...preference, isDefault: false }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await fetchPreferences('t-1')).toEqual([preference])
    const body = toPreferenceRequest(draftFromPreference(preference))
    const saved = await putPreference('t-1', 'PROMISE_NOT_FULFILLED', body)
    expect(saved.isDefault).toBe(false)
    const put = fetchMock.mock.calls[1]![0]
    expect(put.method).toBe('PUT')
    expect(new URL(put.url).pathname).toBe(
      '/api/v1/notifications/preferences/PROMISE_NOT_FULFILLED',
    )
    expect(await put.json()).toEqual(body)
    await resetPreference('t-1', 'NO_RESPONSE')
    const del = fetchMock.mock.calls[2]![0]
    expect(del.method).toBe('DELETE')
    expect(new URL(del.url).pathname).toBe('/api/v1/notifications/preferences/NO_RESPONSE')
  })
})
