/** Полная карточка риска из контракта: общая фикстура для unit-тестов. */
import type { RiskDetail } from '@/entities/risk'

export const riskDetailFixture: RiskDetail = {
  risk: {
    id: 'risk-1',
    opportunityId: 'opp-1',
    locationId: 'loc-1',
    type: 'NO_RESPONSE',
    severity: 'HIGH',
    status: 'OPEN',
    source: 'MANUAL',
    policyVersion: 'frontend-fixture/v1',
    triggerMessageId: 'msg-1',
    reasonCode: 'NO_RESPONSE_THRESHOLD_EXCEEDED',
    reason: 'Бизнес не ответил клиенту в течение 60 рабочих минут',
    detectedAt: '2026-09-18T10:00:00Z',
    dueAt: '2026-09-18T09:00:00Z',
    updatedAt: '2026-09-18T10:00:00Z',
  },
  opportunity: {
    id: 'opp-1',
    stage: 'NEW',
    locationId: 'loc-1',
    serviceId: 'svc-1',
    potentialRevenue: '5000.00',
    currency: 'RUB',
  },
  conversation: {
    id: 'conv-1',
    contactId: 'contact-1',
    lastMessage: {
      id: 'msg-1',
      direction: 'INCOMING',
      type: 'TEXT',
      preview: 'Нужна полировка',
      sentAt: '2026-09-18T09:00:00Z',
    },
  },
  contact: { id: 'contact-1', displayName: 'Ирина' },
  service: { id: 'svc-1', name: 'Полировка', active: true },
  channel: {
    connectionId: 'conn-1',
    provider: 'CONNECTED_BUSINESS_BOT',
    name: 'Telegram',
    status: 'ACTIVE',
  },
  externalLink: { url: 'tg://user?id=123', kind: 'TELEGRAM_USER', unavailableReason: null },
  recommendation: { id: 'rec-1', text: 'Ответить клиенту сейчас.' },
  actions: [{ id: 'act-1', type: 'CALL', createdAt: '2026-09-18T10:05:00Z' }],
  outcome: { id: 'out-1', type: 'THINKING', createdAt: '2026-09-18T10:10:00Z' },
  revenue: null,
}
