import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  connectionStatusView,
  webhookUrl,
  webhookRequestExample,
  WebhookInstructions,
} from '@/entities/integration'

afterEach(() => vi.unstubAllGlobals())

describe('инструкция webhook', () => {
  it('использует origin API, tenant и ID конкретного подключения', () => {
    expect(webhookUrl('tenant-a', 'conn-1', 'https://api.example.test')).toBe(
      'https://api.example.test/api/v1/webhooks/GENERIC_WEBHOOK/tenant-a/conn-1',
    )
    expect(webhookUrl('tenant-b', 'conn-2', 'http://127.0.0.1:5173')).toBe(
      'http://127.0.0.1:5173/api/v1/webhooks/GENERIC_WEBHOOK/tenant-b/conn-2',
    )
    expect(webhookUrl('a/b', 'c#d', 'https://api.example.test')).toContain('/a%2Fb/c%23d')
  })

  it('пример содержит точный заголовок, актуальное время и сообщение канонического формата', () => {
    const example = webhookRequestExample(
      'https://api.example.test/webhook',
      'event-1',
      '2026-10-04T12:00:00Z',
    )
    expect(example).toContain('X-LidRadar-Webhook-Secret: $LIDRADAR_WEBHOOK_SECRET')
    expect(example).toContain('Content-Type: application/json')
    const payload = JSON.parse(example.split("--data-raw '")[1]!.slice(0, -1))
    expect(payload).toMatchObject({
      id: 'event-1',
      type: 'message.received.v1',
      occurredAt: '2026-10-04T12:00:00Z',
      data: {
        messageExternalId: 'event-1',
        direction: 'INCOMING',
        messageType: 'TEXT',
        sentAt: '2026-10-04T12:00:00Z',
        attachments: [],
        metadata: {},
      },
    })
    expect(payload.data.conversationExternalId).toBeTruthy()
    expect(payload.data.contactExternalId).toBeTruthy()
    expect(payload.data.text).toBeTruthy()
    expect(example).not.toContain('Cookie')
    expect(example).not.toContain('Authorization')
  })

  it('адрес и пример копируются отдельно, при запрете clipboard доступна ручная копия', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(WebhookInstructions, { props: { tenantId: 't', connectionId: 'c' } })
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(wrapper.get('[data-testid="webhook-url"]').text())
    expect(wrapper.text()).toContain('Адрес скопирован')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(
      wrapper.get('[data-testid="webhook-example"]').text(),
    )
    expect(wrapper.text()).toContain('Пример скопирован')
    writeText.mockRejectedValueOnce(new Error('denied'))
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('скопируйте текст вручную')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await wrapper.setProps({ connectionId: 'new', disconnected: true })
    expect(wrapper.get('[data-testid="webhook-url"]').text()).toContain('/t/new')
    expect(wrapper.text()).toContain('больше не принимает события')
    wrapper.unmount()
  })
})

describe('статус webhook', () => {
  it.each([
    ['ACTIVE', null, 'Ожидает первое событие', 'info'],
    ['ACTIVE', '2026-10-04T12:00:00Z', 'Приём подтверждён', 'success'],
    ['ERROR', null, 'Ошибка', 'danger'],
    ['DEGRADED', '2026-10-04T12:00:00Z', 'С перебоями', 'warning'],
    ['DISCONNECTED', '2026-10-04T12:00:00Z', 'Отключён', 'neutral'],
  ] as const)('%s, последний успех %s', (status, lastSuccessAt, label, tone) => {
    expect(connectionStatusView('GENERIC_WEBHOOK', { status, lastSuccessAt })).toEqual({
      label,
      tone,
    })
  })

  it('Telegram сохраняет значение удалённой проверки', () => {
    expect(
      connectionStatusView('CONNECTED_BUSINESS_BOT', { status: 'ACTIVE', lastSuccessAt: null }),
    ).toEqual({ label: 'Работает', tone: 'success' })
  })
})
