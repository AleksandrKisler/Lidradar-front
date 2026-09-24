/** Фикстуры переписки и сообщений по контракту для unit-тестов. */
import type { ConversationDetail, ConversationListItem, MessageView } from '@/entities/conversation'

export const conversationItemFixture: ConversationListItem = {
  conversation: {
    id: '01990000-0000-7000-8000-000000000601',
    locationId: '01990000-0000-7000-8000-000000000201',
    connectionId: '01990000-0000-7000-8000-000000000901',
    contactId: '01990000-0000-7000-8000-000000000701',
    externalId: 'tg-123',
    status: 'ACTIVE',
    firstMessageAt: '2026-09-18T08:00:00Z',
    lastMessageAt: '2026-09-18T10:02:00Z',
    lastMessageDirection: 'INCOMING',
    revision: 3,
    createdAt: '2026-09-18T08:00:00Z',
    updatedAt: '2026-09-18T10:02:00Z',
  },
  contact: { id: '01990000-0000-7000-8000-000000000701', displayName: 'Дмитрий Соколов' },
  channel: {
    connectionId: '01990000-0000-7000-8000-000000000901',
    provider: 'CONNECTED_BUSINESS_BOT',
    name: 'Telegram Business',
    status: 'ACTIVE',
  },
  lastMessage: {
    id: '01990000-0000-7000-8000-000000000803',
    direction: 'INCOMING',
    type: 'TEXT',
    preview: 'А на какое время можно завтра?',
    sentAt: '2026-09-18T10:02:00Z',
  },
  activeRisks: { count: 1, maxSeverity: 'CRITICAL' },
  externalLink: { url: 'tg://user?id=123', kind: 'TELEGRAM_USER', unavailableReason: null },
}

export const conversationDetailFixture: ConversationDetail = {
  conversation: conversationItemFixture.conversation,
  contact: {
    id: '01990000-0000-7000-8000-000000000701',
    displayName: 'Дмитрий Соколов',
    phoneNormalized: '+79991234567',
    emailNormalized: null,
    createdAt: '2026-09-18T08:00:00Z',
    updatedAt: '2026-09-18T08:00:00Z',
  },
  channel: conversationItemFixture.channel,
  externalLink: conversationItemFixture.externalLink,
}

function message(
  id: string,
  direction: MessageView['message']['direction'],
  text: string | null,
  sentAt: string,
  extra: Partial<MessageView['message']> = {},
): MessageView['message'] {
  return {
    id,
    conversationId: conversationItemFixture.conversation.id,
    connectionId: conversationItemFixture.channel.connectionId,
    externalId: `ext-${id}`,
    direction,
    type: 'TEXT',
    text,
    senderExternalId: null,
    replyToMessageId: null,
    sentAt,
    receivedAt: sentAt,
    providerDeletedAt: null,
    metadata: {},
    createdAt: sentAt,
    ...extra,
  }
}

/** Первая страница (новые → старые): три сообщения сегодняшнего дня. */
export const newestPageFixture: MessageView[] = [
  {
    message: message('m-3', 'INCOMING', 'А на какое время можно завтра?', '2026-09-18T10:02:00Z'),
    attachments: [],
  },
  {
    message: message('m-2', 'OUTGOING', 'Полный комплекс — 31 000 ₽.', '2026-09-18T10:00:00Z'),
    attachments: [],
  },
  {
    message: message('m-1', 'INCOMING', null, '2026-09-18T09:56:00Z', { type: 'IMAGE' }),
    attachments: [
      {
        id: 'a-1',
        messageId: 'm-1',
        objectKey: 'missing/object',
        mimeType: 'image/jpeg',
        sizeBytes: 245_760,
        sha256: null,
        providerFileId: null,
        createdAt: '2026-09-18T09:56:00Z',
      },
    ],
  },
]

/** Более старая страница: удалённое сообщение вчерашнего дня. */
export const olderPageFixture: MessageView[] = [
  {
    message: message('m-0', 'OUTGOING', 'Удалённый текст', '2026-09-17T15:00:00Z', {
      providerDeletedAt: '2026-09-17T15:30:00Z',
    }),
    attachments: [],
  },
]
