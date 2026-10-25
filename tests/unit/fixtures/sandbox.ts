import type { SandboxConversation, SandboxTemplate, SandboxVerdict } from '@/entities/sandbox'

export const SANDBOX_ID = '01990000-0000-7000-8066-000000000001'
export const LOCATION_ID = '01990000-0000-7000-8066-000000000201'

export function verdict(overrides: Partial<SandboxVerdict> = {}): SandboxVerdict {
  return {
    state: 'PROCESSING',
    stage: 'ANALYZING',
    expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
    expectedRiskId: null,
    dueAt: null,
    failureCode: null,
    failureMessageId: null,
    conversationId: '01990000-0000-7000-8066-000000000601',
    analysisVersion: null,
    found: [],
    ...overrides,
  }
}

export function sandboxConversation(
  overrides: Partial<SandboxConversation> = {},
): SandboxConversation {
  return {
    id: SANDBOX_ID,
    locationId: LOCATION_ID,
    connectionId: '01990000-0000-7000-8066-000000000301',
    contactName: 'Анна Петрова',
    templateCode: 'customer_silent_after_price',
    templateVersion: 1,
    templateModified: false,
    expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
    createdAt: '2026-10-25T12:00:00Z',
    lastSentAt: '2026-10-24T12:00:00Z',
    messages: [
      {
        id: '01990000-0000-7000-8066-000000000401',
        sequence: 1,
        direction: 'INCOMING',
        text: 'Сколько стоит окрашивание?',
        sentAt: '2026-10-24T11:50:00Z',
      },
      {
        id: '01990000-0000-7000-8066-000000000402',
        sequence: 2,
        direction: 'OUTGOING',
        text: '8 000 ₽, когда удобно?',
        sentAt: '2026-10-24T12:00:00Z',
      },
    ],
    status: verdict(),
    ...overrides,
  }
}

export const priceTemplate: SandboxTemplate = {
  code: 'customer_silent_after_price',
  name: 'Назвали цену, клиент замолчал',
  expectedRiskType: 'CUSTOMER_SILENT_AFTER_PRICE',
  closedBy: 'INCOMING',
  messages: [
    { direction: 'INCOMING', text: 'Сколько стоит окрашивание?', pauseBeforeMinutes: 0 },
    { direction: 'OUTGOING', text: '8 000 ₽, когда удобно?', pauseBeforeMinutes: 10 },
  ],
  tailMinutes: 7200,
  version: 1,
  qualified: true,
}
