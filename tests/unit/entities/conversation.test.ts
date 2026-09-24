import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activeRisksBadge,
  connectionStatusLabel,
  contactInitials,
  contactLabel,
  conversationKeys,
  directionLabel,
  fetchConversation,
  fetchConversations,
  fetchMessages,
  messageTypeLabel,
  orderOldestFirst,
  toConversationRow,
  toMessageBubble,
} from '@/entities/conversation'
import { dayKey, formatBytes, formatDay, maskEmail, maskPhone } from '@/shared/lib'
import {
  conversationDetailFixture,
  conversationItemFixture,
  newestPageFixture,
  olderPageFixture,
} from '../fixtures/conversation'

afterEach(() => vi.unstubAllGlobals())

describe('маскирование и форматы', () => {
  it('скрывает телефон и почту, оставляя опознаваемый хвост', () => {
    expect(maskPhone('+7 (999) 123-45-67')).toBe('••• 45 67')
    expect(maskPhone('12')).toBe('•••')
    expect(maskEmail('dmitry@example.com')).toBe('d•••@example.com')
    expect(maskEmail('broken')).toBe('•••')
  })

  it('форматирует размер файла', () => {
    expect(formatBytes(512)).toBe('512 Б')
    expect(formatBytes(245_760)).toBe('240 КБ')
    expect(formatBytes(1_572_864)).toBe('1,5 МБ')
    expect(formatBytes(-1)).toBe('—')
  })

  it('ключ дня и подпись дня считаются в поясе организации', () => {
    const now = new Date('2026-09-18T12:00:00Z')
    expect(dayKey('2026-09-18T22:30:00Z', 'Europe/Moscow')).toBe('2026-09-19')
    expect(formatDay('2026-09-18T10:00:00Z', 'Europe/Moscow', now)).toBe('Сегодня')
    expect(formatDay('2026-09-17T10:00:00Z', 'Europe/Moscow', now)).toBe('Вчера')
    expect(formatDay('2026-09-01T10:00:00Z', 'Europe/Moscow', now)).toBe('1 сентября')
    expect(formatDay('2025-12-31T10:00:00Z', 'Europe/Moscow', now)).toContain('2025')
    expect(formatDay(null, 'Europe/Moscow', now)).toBeNull()
  })
})

describe('подписи и адаптеры переписки', () => {
  it('подпись контакта: имя → телефон → почта → «Без имени»', () => {
    expect(contactLabel({ displayName: ' Дмитрий ' })).toBe('Дмитрий')
    expect(contactLabel({ displayName: null, phoneNormalized: '+79991234567' })).toBe('••• 45 67')
    expect(contactLabel({ displayName: null, emailNormalized: 'a@b.ru' })).toBe('a•••@b.ru')
    expect(contactLabel({ displayName: null })).toBe('Без имени')
    expect(contactInitials('Дмитрий Соколов')).toBe('ДС')
    expect(contactInitials('••• 45 67')).toBe('•')
    expect(contactInitials('•••')).toBe('•')
  })

  it('строка списка собирает превью, риски и ссылку', () => {
    const row = toConversationRow(conversationItemFixture)
    expect(row).toMatchObject({
      contactName: 'Дмитрий Соколов',
      initials: 'ДС',
      channelName: 'Telegram Business',
      preview: 'А на какое время можно завтра?',
      previewDirection: 'INCOMING',
      lastAt: '2026-09-18T10:02:00Z',
      externalUrl: 'tg://user?id=123',
      risks: { count: 1, label: 'Критичный риск', tone: 'danger' },
    })
    const media = toConversationRow({
      ...conversationItemFixture,
      lastMessage: { ...conversationItemFixture.lastMessage!, type: 'VOICE', preview: null },
      activeRisks: { count: 3, maxSeverity: 'HIGH' },
    })
    expect(media.preview).toBe('Голосовое сообщение')
    expect(media.risks).toEqual({ count: 3, label: 'Высокий риск · 3', tone: 'warning' })
    const silent = toConversationRow({
      ...conversationItemFixture,
      lastMessage: null,
      activeRisks: { count: 0, maxSeverity: null },
    })
    expect(silent.preview).toBeNull()
    expect(silent.lastAt).toBe('2026-09-18T10:02:00Z')
    expect(silent.risks.label).toBe('Без активных рисков')
  })

  it('пузырь сообщения: автор, удаление, вложения без ссылки', () => {
    const text = toMessageBubble(newestPageFixture[1]!)
    expect(text).toMatchObject({ author: 'Менеджер', direction: 'OUTGOING', deleted: false })
    const image = toMessageBubble(newestPageFixture[2]!)
    expect(image.text).toBeNull()
    expect(image.typeLabel).toBe('Изображение')
    expect(image.attachments).toEqual([
      { id: 'a-1', label: 'Изображение', size: '240 КБ', mimeType: 'image/jpeg' },
    ])
    const deleted = toMessageBubble(olderPageFixture[0]!)
    expect(deleted.deleted).toBe(true)
  })

  it('разворачивает страницы «новые → старые» в хронологию', () => {
    const ordered = orderOldestFirst([
      { items: newestPageFixture, nextCursor: 'older' },
      { items: olderPageFixture, nextCursor: null },
    ])
    expect(ordered.map((view) => view.message.id)).toEqual(['m-0', 'm-1', 'm-2', 'm-3'])
  })

  it('подписи перечислений и неизвестные значения', () => {
    expect(directionLabel('SYSTEM')).toBe('Система')
    expect(messageTypeLabel('DOCUMENT')).toBe('Документ')
    expect(messageTypeLabel('STICKER')).toBe('STICKER')
    expect(connectionStatusLabel('DEGRADED')).toBe('работает с перебоями')
    expect(activeRisksBadge({ count: 2, maxSeverity: 'ULTRA' })).toEqual({
      label: 'Активный риск · 2',
      tone: 'neutral',
    })
  })
})

describe('запросы переписок', () => {
  it('ключи включают организацию и нормализованные фильтры', () => {
    expect(
      conversationKeys.list('t', { withRisk: true, search: 'дим', locationId: undefined }),
    ).toEqual(['tenant', 't', 'conversations', { search: 'дим', withRisk: true }])
    expect(conversationKeys.messages('t', 'c')).toEqual([
      'tenant',
      't',
      'conversation',
      'c',
      'messages',
    ])
  })

  it('передаёт только заданные фильтры, курсор и лимиты', async () => {
    const fetchMock = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockImplementation((request) => {
        const path = new URL(request.url).pathname
        const body = path.endsWith('/messages')
          ? { items: newestPageFixture, nextCursor: null }
          : path.endsWith('/conversations')
            ? { items: [conversationItemFixture], nextCursor: 'next' }
            : conversationDetailFixture
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })
    vi.stubGlobal('fetch', fetchMock)
    const page = await fetchConversations(
      'tenant-a',
      { search: 'Дмитрий', withRisk: true, status: undefined },
      'cur-1',
    )
    expect(page.nextCursor).toBe('next')
    const listUrl = new URL(fetchMock.mock.calls[0]![0].url)
    expect(listUrl.searchParams.get('search')).toBe('Дмитрий')
    expect(listUrl.searchParams.get('withRisk')).toBe('true')
    expect(listUrl.searchParams.get('cursor')).toBe('cur-1')
    expect(listUrl.searchParams.get('limit')).toBe('30')
    expect(listUrl.searchParams.has('status')).toBe(false)
    expect(fetchMock.mock.calls[0]![0].headers.get('X-Tenant-ID')).toBe('tenant-a')

    await fetchConversations('tenant-a', {}, null)
    const plainUrl = new URL(fetchMock.mock.calls[1]![0].url)
    expect(plainUrl.searchParams.has('withRisk')).toBe(false)

    const detail = await fetchConversation('tenant-a', 'conv-1')
    expect(detail.contact.displayName).toBe('Дмитрий Соколов')
    const messages = await fetchMessages('tenant-a', 'conv-1', 'older')
    expect(messages.items).toHaveLength(3)
    const messagesUrl = new URL(fetchMock.mock.calls[3]![0].url)
    expect(messagesUrl.pathname).toBe('/api/v1/conversations/conv-1/messages')
    expect(messagesUrl.searchParams.get('limit')).toBe('50')
    expect(messagesUrl.searchParams.get('cursor')).toBe('older')
  })
})
