import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FEEDBACK_REASONS,
  MANUAL_ACTION_TYPES,
  actionTypeLabel,
  feedbackReasonLabel,
  verdictLabel,
  externalLinkUnavailableLabel,
  fetchActiveRisks,
  fetchRadarSummary,
  isActiveRiskStatus,
  opportunityStageLabel,
  outcomeStatusLabel,
  riskKeys,
  riskStatusLabel,
  riskTypeLabel,
  severityLabel,
  severityTone,
  toRiskCard,
  toRiskWorkspace,
  UNNAMED_CONTACT,
} from '@/entities/risk'
import { riskDetailFixture } from '../fixtures/risk-detail'

describe('адаптер карточки риска', () => {
  it('переносит контекст и форматирует деньги', () => {
    const card = toRiskCard(riskDetailFixture)
    expect(card).toMatchObject({
      id: 'risk-1',
      severityLabel: 'Высокий',
      severityTone: 'warning',
      typeLabel: 'Нет ответа клиенту',
      statusLabel: 'Новый',
      contactName: 'Ирина',
      serviceName: 'Полировка',
      channelName: 'Telegram',
      potential: '5 000 ₽',
      currency: 'RUB',
      externalUrl: 'tg://user?id=123',
      externalUnavailableReason: null,
      hasRecommendation: true,
      actionsCount: 1,
      outcomeLabel: 'Думает',
    })
    expect(card.lastMessage).toEqual({
      preview: 'Нужна полировка',
      direction: 'INCOMING',
      sentAt: '2026-09-18T09:00:00Z',
    })
  })

  it('честно показывает отсутствующие связи', () => {
    const card = toRiskCard({
      ...riskDetailFixture,
      opportunity: { ...riskDetailFixture.opportunity!, potentialRevenue: null, serviceId: null },
      contact: { id: 'contact-1', displayName: '   ' },
      service: null,
      channel: null,
      conversation: { id: 'conv-1', contactId: 'contact-1', lastMessage: null },
      externalLink: { url: null, kind: null, unavailableReason: 'PROVIDER_UNSUPPORTED' },
      recommendation: null,
      actions: [],
      outcome: { id: 'out-2', type: 'UNKNOWN_STATUS', createdAt: '2026-09-18T10:10:00Z' },
    })
    expect(card.contactName).toBe(UNNAMED_CONTACT)
    expect(card.serviceName).toBeNull()
    expect(card.channelName).toBeNull()
    expect(card.potential).toBeNull()
    expect(card.lastMessage).toBeNull()
    expect(card.externalUrl).toBeNull()
    expect(card.externalUnavailableReason).toBe('PROVIDER_UNSUPPORTED')
    expect(card.hasRecommendation).toBe(false)
    expect(card.actionsCount).toBe(0)
    expect(card.outcomeLabel).toBe('UNKNOWN_STATUS')
  })

  it('без сделки не пытается форматировать валюту', () => {
    const card = toRiskCard({ ...riskDetailFixture, opportunity: null })
    expect(card.potential).toBeNull()
    expect(card.currency).toBeNull()
  })
})

describe('подписи перечислений', () => {
  it('знает все значения контракта и безопасно показывает новые', () => {
    expect(severityLabel('CRITICAL')).toBe('Критично')
    expect(severityTone('CRITICAL')).toBe('danger')
    expect(severityLabel('ULTRA')).toBe('ULTRA')
    expect(severityTone('ULTRA')).toBe('neutral')
    expect(riskTypeLabel('FOLLOW_UP_CANDIDATE')).toBe('Стоит напомнить о себе')
    expect(riskTypeLabel('NEW_TYPE')).toBe('NEW_TYPE')
    expect(riskStatusLabel('FALSE_POSITIVE')).toBe('Ложное срабатывание')
  })
})

describe('запросы Radar', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ключи включают организацию и нормализованные фильтры', () => {
    expect(riskKeys.summary('t', { severity: 'HIGH', locationId: undefined })).toEqual([
      'tenant',
      't',
      'radar',
      { severity: 'HIGH' },
    ])
    expect(riskKeys.activeFeed('t', { riskType: 'NO_RESPONSE' })).toEqual([
      'tenant',
      't',
      'risks',
      { riskType: 'NO_RESPONSE', active: true },
    ])
  })

  it('сводка не передаёт статус, лента запрашивает активные риски с курсором', async () => {
    const fetchMock = vi.fn().mockImplementation((request: Request) => {
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/radar') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              openRisks: 2,
              criticalRisks: 1,
              potentialRevenue: '1.00',
              confirmedRecoveredRevenue: '0.00',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ items: [riskDetailFixture], nextCursor: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
    const summary = await fetchRadarSummary('tenant-a', { severity: 'HIGH' })
    expect(summary.openRisks).toBe(2)
    const summaryRequest = fetchMock.mock.calls[0]![0] as Request
    const summaryUrl = new URL(summaryRequest.url)
    expect(summaryUrl.searchParams.get('severity')).toBe('HIGH')
    expect(summaryUrl.searchParams.has('active')).toBe(false)
    expect(summaryRequest.headers.get('X-Tenant-ID')).toBe('tenant-a')

    const page = await fetchActiveRisks('tenant-a', { severity: 'HIGH' }, 'cursor-1')
    expect(page.items).toHaveLength(1)
    const feedUrl = new URL((fetchMock.mock.calls[1]![0] as Request).url)
    expect(feedUrl.searchParams.get('active')).toBe('true')
    expect(feedUrl.searchParams.get('cursor')).toBe('cursor-1')
    expect(feedUrl.searchParams.get('limit')).toBe('20')
    expect(feedUrl.searchParams.get('severity')).toBe('HIGH')
  })
})

describe('модель рабочего пространства', () => {
  it('собирает историю по убыванию времени и признак активности', () => {
    const vm = toRiskWorkspace({
      ...riskDetailFixture,
      actions: [
        { id: 'a-1', type: 'OPEN_CONVERSATION', createdAt: '2026-09-18T10:01:00Z' },
        { id: 'a-2', type: 'CALL', createdAt: '2026-09-18T10:20:00Z' },
      ],
      outcome: { id: 'o-1', type: 'THINKING', createdAt: '2026-09-18T10:10:00Z' },
      revenue: { currency: 'RUB', potential: '5000.00', confirmedRecovered: '0.00' },
    })
    expect(vm.history.map((entry) => entry.label)).toEqual([
      'Звонок клиенту',
      'Думает',
      'Переход в диалог',
    ])
    expect(vm.history[1]?.kind).toBe('outcome')
    expect(vm.isActive).toBe(true)
    expect(vm.status).toBe('OPEN')
    expect(vm.statusTone).toBe('brand')
    expect(vm.sourceLabel).toBe('Вручную')
    expect(vm.stageLabel).toBe('Новая')
    expect(vm.money).toEqual({ potential: '5 000 ₽', confirmedRecovered: '0 ₽', currency: 'RUB' })
    expect(vm.recommendation).toBe('Ответить клиенту сейчас.')
    expect(vm.opportunityId).toBe('opp-1')
    expect(vm.conversationId).toBe('conv-1')
  })

  it('терминальный и неизвестный статусы не активируют команды', () => {
    const resolved = toRiskWorkspace({
      ...riskDetailFixture,
      risk: { ...riskDetailFixture.risk, status: 'RESOLVED', resolvedAt: '2026-09-18T11:00:00Z' },
    })
    expect(resolved.isActive).toBe(false)
    expect(resolved.resolvedAt).toBe('2026-09-18T11:00:00Z')
    const unknown = toRiskWorkspace({
      ...riskDetailFixture,
      risk: { ...riskDetailFixture.risk, status: 'SNOOZED' as never },
    })
    expect(unknown.isActive).toBe(false)
    expect(unknown.statusLabel).toBe('SNOOZED')
    expect(unknown.statusTone).toBe('neutral')
    expect(isActiveRiskStatus('ACTED')).toBe(true)
    expect(isActiveRiskStatus('EXPIRED')).toBe(false)
  })

  it('без выручки и сделки деньги честно отсутствуют', () => {
    const vm = toRiskWorkspace({
      ...riskDetailFixture,
      opportunity: null,
      revenue: null,
      outcome: null,
    })
    expect(vm.money).toBeNull()
    expect(vm.stageLabel).toBeNull()
    expect(vm.outcomeAt).toBeNull()
    expect(vm.history.map((entry) => entry.kind)).toEqual(['action'])
  })

  it('подписи действий, исходов, этапов и недоступной ссылки', () => {
    expect(actionTypeLabel('SEND_MESSAGE')).toBe('Сообщение отправлено')
    expect(actionTypeLabel('UNKNOWN')).toBe('UNKNOWN')
    expect(outcomeStatusLabel('NOT_A_LEAD')).toBe('Не лид')
    expect(opportunityStageLabel('BOOKING_INTENT')).toBe('Хочет записаться')
    expect(externalLinkUnavailableLabel(null)).toBeNull()
    expect(externalLinkUnavailableLabel('IDENTITY_UNKNOWN')).toBe(
      'Собеседник в канале не определён',
    )
    expect(externalLinkUnavailableLabel('NEW_REASON')).toBe('Внешний переход недоступен')
    expect(MANUAL_ACTION_TYPES).not.toContain('OPEN_CONVERSATION')
    expect(verdictLabel('TRUE_POSITIVE')).toBe('Риск подтвердился')
    expect(feedbackReasonLabel('NOT_A_LEAD')).toBe('Это не клиент')
    expect(feedbackReasonLabel('NEW')).toBe('NEW')
    expect(FEEDBACK_REASONS.at(-1)).toBe('OTHER')
  })
})
