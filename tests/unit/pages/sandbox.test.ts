import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiError } from '@/shared/api'
import { useSandbox } from '@/pages/sandbox/model/use-sandbox'
import { sandboxApi } from '@/pages/sandbox/api/sandbox-api'

const state = vi.hoisted(() => ({ session: {} as Record<string, unknown> }))
vi.mock('@/entities/session', () => ({ useSessionStore: () => state.session }))
vi.mock('@/entities/location', () => ({
  useLocationsQuery: () => ({ data: { value: [] }, error: { value: null } }),
}))
vi.mock('@/pages/sandbox/api/sandbox-api', () => ({
  sandboxApi: {
    overview: vi.fn(),
    templates: vi.fn(),
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    send: vi.fn(),
  },
}))
const overview = {
  enabled: true as const,
  limits: { conversationsPerDay: 20, messagesPerDay: 200, aiQueueLimit: 3 },
  usage: { conversations: 0, messages: 0 },
  rules: { maxMessagesPerBuild: 30, maxHistoryMinutes: 10080, maxTextLength: 4000 },
}
const template = {
  code: 'no_response',
  name: 'Нет ответа',
  qualified: true,
  expectedRiskType: 'NO_RESPONSE' as const,
  closedBy: 'OUTGOING' as const,
  version: 1,
  tailMinutes: 1440,
  messages: [{ direction: 'INCOMING' as const, text: 'Сколько стоит?', pauseBeforeMinutes: 0 }],
}
let cleanup: (() => void) | undefined
async function setup() {
  let model!: ReturnType<typeof useSandbox>
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(
    defineComponent({
      setup() {
        model = useSandbox()
        return () => null
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  cleanup = () => {
    wrapper.unmount()
    client.clear()
  }
  await flushPromises()
  return model
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  state.session = reactive({
    user: { id: 'user-a' },
    tenantId: 'tenant-a',
    sandboxEnabled: true,
    can: () => true,
  })
  vi.mocked(sandboxApi.overview).mockResolvedValue(overview)
  vi.mocked(sandboxApi.templates).mockResolvedValue({
    items: [template, { ...template, code: 'hidden', qualified: false }],
  })
  vi.mocked(sandboxApi.list).mockResolvedValue({ items: [] })
})
afterEach(() => cleanup?.())
describe('песочница', () => {
  it('без capability не обращается к API', async () => {
    state.session.sandboxEnabled = false
    const m = await setup()
    expect(m.enabled.value).toBe(false)
    expect(sandboxApi.overview).not.toHaveBeenCalled()
    expect(sandboxApi.list).not.toHaveBeenCalled()
  })
  it('показывает только квалифицированные шаблоны и копирует состав', async () => {
    const m = await setup()
    expect(m.qualified.value).toHaveLength(1)
    m.applyTemplate('no_response')
    expect(m.draft.value.messages).toEqual(template.messages)
    expect(m.draft.value.messages).not.toBe(template.messages)
    m.applyTemplate('hidden')
    expect(m.draft.value.templateCode).toBe('no_response')
  })
  it('пустой текст, предел длины и количества не создают сообщений', async () => {
    const m = await setup()
    await m.add('INCOMING')
    expect(m.validation.value).toBe('Введите текст сообщения')
    m.text.value = 'a'.repeat(4001)
    await m.add('INCOMING')
    expect(m.validation.value).toBe('Сообщение слишком длинное')
    m.draft.value.messages = Array.from({ length: 30 }, () => ({ ...template.messages[0]! }))
    m.text.value = 'Привет'
    await m.add('INCOMING')
    expect(m.draft.value.messages).toHaveLength(30)
  })
  it('добавляет сообщение с паузой, сохраняет черновик только своей организации', async () => {
    const m = await setup()
    m.text.value = '  Привет  '
    m.pause.value = '60'
    await m.add('OUTGOING')
    expect(m.draft.value.messages).toEqual([
      { direction: 'OUTGOING', text: 'Привет', pauseBeforeMinutes: 60 },
    ])
    expect(m.text.value).toBe('')
    expect(m.pause.value).toBe('0')
    state.session.tenantId = 'tenant-b'
    await nextTick()
    expect(m.draft.value.messages).toEqual([])
    state.session.tenantId = 'tenant-a'
    await nextTick()
    expect(m.draft.value.messages).toHaveLength(1)
  })
  it('валидирует точку, сообщения и суммарную давность до POST', async () => {
    const m = await setup()
    await m.submit()
    expect(m.validation.value).toContain('Выберите точку')
    m.applyTemplate('no_response')
    m.draft.value.locationId = 'location-a'
    m.draft.value.tailMinutes = 10080
    m.draft.value.messages.push({ direction: 'OUTGOING', text: 'Ответ', pauseBeforeMinutes: 1 })
    await m.submit()
    expect(m.validation.value).toContain('7 суток')
    expect(sandboxApi.create).not.toHaveBeenCalled()
  })
  it('восстанавливает валидный черновик', async () => {
    localStorage.setItem(
      'lidradar:sandbox:draft:user-a:tenant-a',
      JSON.stringify({
        locationId: 'a',
        contactName: 'Анна',
        templateCode: 'empty',
        tailMinutes: 0,
        messages: [],
      }),
    )
    const m = await setup()
    expect(m.draft.value.contactName).toBe('Анна')
  })
  it.each(['{}', 'не json'])('повреждённое хранилище %s даёт явную подсказку', async (raw) => {
    localStorage.setItem('lidradar:sandbox:draft:user-a:tenant-a', raw)
    const m = await setup()
    expect(m.storageError.value).toBeTruthy()
    expect(m.draft.value.messages).toEqual([])
  })
  it('неизвестный результат фиксирует пару key/body и блокирует редактирование', async () => {
    vi.mocked(sandboxApi.create).mockRejectedValue(
      new ApiError({ httpStatus: 503, code: 'SANDBOX_DELIVERY_UNAVAILABLE' }),
    )
    const m = await setup()
    m.applyTemplate('no_response')
    m.draft.value.locationId = 'a'
    await m.submit()
    expect(m.locked.value).toBe(true)
    expect(m.errorText.value).toContain('Не все сообщения доставлены')
    m.applyTemplate('empty')
    expect(m.draft.value.templateCode).toBe('no_response')
    await m.create.retry()
    expect(vi.mocked(sandboxApi.create).mock.calls[1]).toEqual(
      vi.mocked(sandboxApi.create).mock.calls[0],
    )
  })
})

const result = {
  id: 'conversation-a',
  locationId: 'location-a',
  connectionId: 'channel-a',
  contactName: 'Анна',
  templateCode: 'no_response',
  templateVersion: 1,
  templateModified: false,
  expectedRiskType: 'NO_RESPONSE' as const,
  createdAt: '2026-10-31T10:00:00Z',
  lastSentAt: null,
  messages: [],
  status: {
    state: 'MATCH' as const,
    stage: null,
    expectedRiskType: 'NO_RESPONSE' as const,
    expectedRiskId: null,
    dueAt: null,
    failureCode: null,
    failureMessageId: null,
    conversationId: null,
    analysisVersion: null,
    found: [],
  },
}
async function readyDraft() {
  const m = await setup()
  m.applyTemplate('no_response')
  m.draft.value.locationId = 'location-a'
  return m
}
it.each([
  ['SANDBOX_BUSY', 409, 'Другая переписка'],
  ['SANDBOX_LIMIT', 429, 'суточный лимит'],
  ['SANDBOX_AI_BUSY', 429, 'Очередь анализа'],
  ['SANDBOX_CHANNEL_DISCONNECTED', 409, 'Канал песочницы отключён'],
] as const)('%s сохраняет черновик и объясняет ограничение', async (code, httpStatus, message) => {
  vi.mocked(sandboxApi.create).mockRejectedValue(new ApiError({ code, httpStatus }))
  const m = await readyDraft()
  await m.submit()
  expect(m.draft.value.messages).toHaveLength(1)
  expect(m.errorText.value).toContain(message)
  expect(m.locked.value).toBe(false)
})
it.each(['IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_KEY_EXPIRED'])(
  '%s блокирует новую команду',
  async (code) => {
    vi.mocked(sandboxApi.create).mockRejectedValue(new ApiError({ code, httpStatus: 409 }))
    const m = await readyDraft()
    await m.submit()
    expect(m.locked.value).toBe(true)
    await m.submit()
    expect(sandboxApi.create).toHaveBeenCalledTimes(1)
    expect(m.errorText.value).toBeTruthy()
  },
)
it('успешная сборка выбирает результат, очищает только подтверждённый черновик', async () => {
  vi.mocked(sandboxApi.create).mockResolvedValue(result)
  vi.mocked(sandboxApi.list).mockResolvedValue({ items: [result] })
  vi.mocked(sandboxApi.detail).mockResolvedValue(result)
  const m = await readyDraft()
  await m.submit()
  expect(m.selectedId.value).toBe(result.id)
  expect(m.selected.value?.id).toBe(result.id)
  expect(m.draft.value.messages).toEqual([])
  m.text.value = 'Спасибо'
  vi.mocked(sandboxApi.send).mockResolvedValue(result)
  await m.add('OUTGOING')
  expect(sandboxApi.send).toHaveBeenCalledWith(
    'tenant-a',
    result.id,
    { direction: 'OUTGOING', text: 'Спасибо' },
    expect.any(String),
  )
  expect(m.text.value).toBe('')
})
it.each(['tenant', 'user'])(
  'поздний ответ сборки после смены %s не попадает в новый контекст',
  async (context) => {
    let finish!: (value: typeof result) => void
    vi.mocked(sandboxApi.create).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const m = await readyDraft()
    const pending = m.submit()
    if (context === 'tenant') state.session.tenantId = 'tenant-b'
    else state.session.user = { id: 'user-b' }
    await nextTick()
    m.draft.value.contactName = 'Другой контекст'
    finish(result)
    await pending
    expect(m.selectedId.value).toBe('')
    expect(m.draft.value.contactName).toBe('Другой контекст')
    expect(m.conversations.value).toEqual([])
  },
)
it('потеря capability запрещает повтор POST, восстановление сохраняет прежнюю пару', async () => {
  vi.mocked(sandboxApi.create).mockRejectedValue(
    new ApiError({ httpStatus: 503, code: 'SANDBOX_DELIVERY_UNAVAILABLE' }),
  )
  const m = await readyDraft()
  await m.submit()
  state.session.sandboxEnabled = false
  await nextTick()
  await m.create.retry()
  await m.submit()
  expect(sandboxApi.create).toHaveBeenCalledTimes(1)
  state.session.sandboxEnabled = true
  await nextTick()
  await m.create.retry()
  expect(sandboxApi.create).toHaveBeenCalledTimes(2)
  expect(vi.mocked(sandboxApi.create).mock.calls[1]).toEqual(
    vi.mocked(sandboxApi.create).mock.calls[0],
  )
})
it('устаревший detail GET не откатывает подтверждённое новое сообщение', async () => {
  let finishRead!: (value: typeof result) => void
  vi.mocked(sandboxApi.detail).mockReturnValue(
    new Promise((resolve) => {
      finishRead = resolve
    }),
  )
  vi.mocked(sandboxApi.create).mockResolvedValue(result)
  vi.mocked(sandboxApi.list).mockResolvedValue({ items: [result] })
  const m = await readyDraft()
  await m.submit()
  await flushPromises()
  expect(sandboxApi.detail).toHaveBeenCalled()
  const updated = {
    ...result,
    messages: [
      {
        id: 'message-new',
        sequence: 1,
        direction: 'INCOMING' as const,
        text: 'Новое сообщение',
        sentAt: '2026-10-31T11:00:00Z',
      },
    ],
  }
  vi.mocked(sandboxApi.send).mockResolvedValue(updated)
  vi.mocked(sandboxApi.list).mockResolvedValue({ items: [updated] })
  m.text.value = 'Новое сообщение'
  await m.add('INCOMING')
  finishRead(result)
  await flushPromises()
  expect(m.selected.value?.messages).toEqual(updated.messages)
})

it('восстанавливаемый отказ отправки сохраняет текст; явный повтор отправляет его и очищает после успеха', async () => {
  vi.mocked(sandboxApi.create).mockResolvedValue(result)
  vi.mocked(sandboxApi.list).mockResolvedValue({ items: [result] })
  vi.mocked(sandboxApi.detail).mockResolvedValue(result)
  const m = await readyDraft()
  await m.submit()
  m.text.value = 'Сообщение после отказа'
  vi.mocked(sandboxApi.send)
    .mockRejectedValueOnce(new ApiError({ httpStatus: 409, code: 'SANDBOX_BUSY' }))
    .mockResolvedValueOnce(result)
  await m.add('OUTGOING')
  expect(m.text.value).toBe('Сообщение после отказа')
  expect(sandboxApi.send).toHaveBeenCalledTimes(1)
  await m.add('OUTGOING')
  expect(sandboxApi.send).toHaveBeenCalledTimes(2)
  expect(vi.mocked(sandboxApi.send).mock.calls[1]!.slice(0, 3)).toEqual(
    vi.mocked(sandboxApi.send).mock.calls[0]!.slice(0, 3),
  )
  expect(m.text.value).toBe('')
})
