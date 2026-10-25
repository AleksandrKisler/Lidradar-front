import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { fetchMe, useSessionStore } from '@/entities/session'
import { createSandboxConversation, sendSandboxMessage, sandboxKeys } from '@/entities/sandbox'
import {
  addDraftMessage,
  browserStorage,
  draftFromTemplate,
  editDraftMessage,
  hasModifiedTemplate,
  draftStorageKey,
  readDraft,
  removeDraftMessage,
  toCreateRequest,
  useCreateSandboxConversation,
  useSandboxDraft,
  writeDraft,
  type SandboxDraft,
} from '@/features/sandbox/build-conversation'
import { useSendSandboxMessage } from '@/features/sandbox/send-message'
import { ApiError } from '@/shared/api'
import { LOCATION_ID, SANDBOX_ID, priceTemplate, sandboxConversation } from '../fixtures/sandbox'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))
vi.mock('@/entities/sandbox/api/sandbox-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/entities/sandbox/api/sandbox-api')>()
  return { ...original, createSandboxConversation: vi.fn(), sendSandboxMessage: vi.fn() }
})

describe('черновик переписки', () => {
  it('собирается из шаблона, дополняется и превращается в тело команды', () => {
    let draft = draftFromTemplate(priceTemplate, LOCATION_ID)
    expect(draft.messages).toHaveLength(2)
    expect(draft.messages[0]).not.toBe(priceTemplate.messages[0])
    draft = addDraftMessage({ ...draft, nextPause: 60 }, 'INCOMING', '  Хорошо  ')
    expect(draft.messages[2]).toEqual({
      direction: 'INCOMING',
      text: 'Хорошо',
      pauseBeforeMinutes: 60,
    })
    expect(draft.nextPause).toBe(0)
    draft = removeDraftMessage(draft, 0)
    expect(draft.messages[0]!.pauseBeforeMinutes).toBe(0)
    expect(toCreateRequest({ ...draft, contactName: '  Анна  ' })).toEqual({
      locationId: LOCATION_ID,
      templateCode: 'customer_silent_after_price',
      tailMinutes: 7200,
      contactName: 'Анна',
      messages: [
        { direction: 'OUTGOING', text: '8 000 ₽, когда удобно?', pauseBeforeMinutes: 0 },
        { direction: 'INCOMING', text: 'Хорошо', pauseBeforeMinutes: 60 },
      ],
    })
    expect(toCreateRequest(draft)).not.toHaveProperty('contactName')
    const first = addDraftMessage({ ...draft, messages: [], nextPause: 180 }, 'INCOMING', 'Привет')
    expect(first.messages[0]!.pauseBeforeMinutes).toBe(0)
  })

  it('позволяет править текст шаблона только в черновике и сохраняет правку', () => {
    const original = draftFromTemplate(priceTemplate, LOCATION_ID)
    expect(hasModifiedTemplate(original, priceTemplate)).toBe(false)
    const edited = editDraftMessage(original, 1, 'Другая цена')
    expect(original.messages[1]!.text).toBe('8 000 ₽, когда удобно?')
    expect(edited.messages[1]!.text).toBe('Другая цена')
    expect(hasModifiedTemplate(edited, priceTemplate)).toBe(true)
    expect(toCreateRequest(edited).messages[1]!.text).toBe('Другая цена')
    const key = draftStorageKey('user-1', 'tenant-a')
    writeDraft(browserStorage(), key, edited)
    expect(hasModifiedTemplate(readDraft(browserStorage(), key)!, priceTemplate)).toBe(true)
    expect(editDraftMessage(edited, -1, 'x')).toBe(edited)
  })

  it('хранится в браузере и отбрасывает повреждённые записи', () => {
    localStorage.clear()
    const key = draftStorageKey('user-1', 'tenant-a')
    const draft = draftFromTemplate(priceTemplate, LOCATION_ID)
    writeDraft(browserStorage(), key, draft)
    expect(readDraft(browserStorage(), key)).toEqual(draft)
    localStorage.setItem(key, '{"templateCode":1}')
    expect(readDraft(browserStorage(), key)).toBeNull()
    localStorage.setItem(
      key,
      JSON.stringify({
        ...draft,
        messages: [{ direction: 'SYSTEM', text: 'x', pauseBeforeMinutes: 0 }],
      }),
    )
    expect(readDraft(browserStorage(), key)).toBeNull()
    localStorage.setItem(key, 'not json')
    expect(readDraft(browserStorage(), key)).toBeNull()
    writeDraft(browserStorage(), key, null)
    expect(localStorage.getItem(key)).toBeNull()
    expect(readDraft(null, key)).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    } as unknown as Storage
    expect(readDraft(broken, key)).toBeNull()
    expect(() => writeDraft(broken, key, draft)).not.toThrow()
  })
})

describe('команды песочницы', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.mocked(createSandboxConversation).mockReset()
    vi.mocked(sendSandboxMessage).mockReset()
    vi.mocked(fetchMe).mockResolvedValue({
      canCreateOrganization: false,
      sandbox: true,
      user: {
        emailVerifiedAt: null,
        deletionDueAt: null,
        id: 'user-1',
        email: 'a@b.c',
        displayName: 'A',
        status: 'ACTIVE',
        createdAt: '',
        updatedAt: '',
      },
      memberships: [{ tenantId: 'tenant-a', organizationName: 'A', role: 'MANAGER' }],
    })
    await useSessionStore().bootstrap()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  function withSetup<T>(setup: () => T): T {
    let result!: T
    mount(
      defineComponent({
        setup: () => {
          result = setup()
          return () => h('div')
        },
      }),
      {
        global: { plugins: [[VueQueryPlugin, { queryClient }]] },
      },
    )
    return result
  }

  it('сессия знает о песочнице, черновик живёт в браузере пользователя и организации', async () => {
    expect(useSessionStore().sandbox).toBe(true)
    const { draft, update } = withSetup(() => useSandboxDraft())
    expect(draft.value).toBeNull()
    const next: SandboxDraft = draftFromTemplate(priceTemplate, LOCATION_ID)
    update(next)
    expect(readDraft(browserStorage(), draftStorageKey('user-1', 'tenant-a'))).toEqual(next)
    useSessionStore().clearTenant()
    await nextTick()
    expect(draft.value).toBeNull()
  })

  it('сборка сохраняет ответ в кеш и сообщает о созданной переписке', async () => {
    vi.mocked(createSandboxConversation).mockResolvedValue({
      conversation: sandboxConversation(),
      created: true,
    })
    const created = vi.fn()
    const mutation = withSetup(() => useCreateSandboxConversation(created))
    const body = toCreateRequest(draftFromTemplate(priceTemplate, LOCATION_ID))
    await mutation.submit(body)
    await flushPromises()
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: SANDBOX_ID }))
    const [tenant, key, sent] = vi.mocked(createSandboxConversation).mock.calls[0]!
    expect(tenant).toBe('tenant-a')
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(sent).toEqual(body)
    expect(queryClient.getQueryData(sandboxKeys.conversation('tenant-a', SANDBOX_ID))).toBeTruthy()
  })

  it('недошедшую сборку повторяет тем же ключом', async () => {
    vi.mocked(createSandboxConversation)
      .mockRejectedValueOnce(
        new ApiError({ httpStatus: 503, code: 'SANDBOX_DELIVERY_UNAVAILABLE' }),
      )
      .mockResolvedValueOnce({ conversation: sandboxConversation(), created: false })
    const mutation = withSetup(() => useCreateSandboxConversation(vi.fn()))
    await mutation.submit(toCreateRequest(draftFromTemplate(priceTemplate, LOCATION_ID)))
    expect(mutation.canRetry.value).toBe(true)
    await mutation.retry()
    const keys = vi.mocked(createSandboxConversation).mock.calls.map((call) => call[1])
    expect(keys[0]).toBe(keys[1])
    expect(mutation.status.value).toBe('success')
  })

  it('сообщение уходит в выбранную переписку', async () => {
    vi.mocked(sendSandboxMessage).mockResolvedValue({
      conversation: sandboxConversation(),
      created: true,
    })
    const mutation = withSetup(() => useSendSandboxMessage(() => SANDBOX_ID))
    await mutation.submit({ direction: 'INCOMING', text: 'Хорошо' })
    await flushPromises()
    const [tenant, conversation, , body] = vi.mocked(sendSandboxMessage).mock.calls[0]!
    expect([tenant, conversation, body]).toEqual([
      'tenant-a',
      SANDBOX_ID,
      { direction: 'INCOMING', text: 'Хорошо' },
    ])
    expect(mutation.status.value).toBe('success')
  })
  it('очищает созданный черновик до обновления кеша и не трогает новую организацию', async () => {
    let finishRefresh!: () => void
    const refresh = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(refresh)
    vi.mocked(createSandboxConversation).mockResolvedValue({
      conversation: sandboxConversation(),
      created: true,
    })
    let text = 'Старый черновик'
    const created = vi.fn(() => {
      text = ''
    })
    const mutation = withSetup(() => useCreateSandboxConversation(created))
    const pending = mutation.submit(toCreateRequest(draftFromTemplate(priceTemplate, LOCATION_ID)))
    await flushPromises()
    expect(created).toHaveBeenCalledTimes(1)
    expect(text).toBe('')
    useSessionStore().clearTenant()
    text = 'Черновик другой организации'
    finishRefresh()
    await pending
    expect(text).toBe('Черновик другой организации')
    expect(created).toHaveBeenCalledTimes(1)
    invalidation.mockRestore()
  })

  it('очищает подтверждённое сообщение до обновления кеша и не трогает другой диалог', async () => {
    let finishRefresh!: () => void
    const refresh = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(refresh)
    vi.mocked(sendSandboxMessage).mockResolvedValue({
      conversation: sandboxConversation(),
      created: true,
    })
    const selected = ref(SANDBOX_ID)
    let text = 'Хорошо'
    const sent = vi.fn(() => {
      text = ''
    })
    const mutation = withSetup(() => useSendSandboxMessage(selected, sent))
    const pending = mutation.submit({ direction: 'INCOMING', text })
    await flushPromises()
    expect(sent).toHaveBeenCalledTimes(1)
    expect(text).toBe('')
    selected.value = 'another-conversation'
    text = 'Сообщение в другом диалоге'
    finishRefresh()
    await pending
    expect(text).toBe('Сообщение в другом диалоге')
    expect(sent).toHaveBeenCalledTimes(1)
    invalidation.mockRestore()
  })
})
