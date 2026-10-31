import { computed, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useSessionStore } from '@/entities/session'
import { useLocationsQuery } from '@/entities/location'
import { useIdempotentMutation, tenantScope, describeError, isApiError } from '@/shared/api'
import { sandboxApi, type Conversation, type Draft, type Send } from '../api/sandbox-api'

const emptyDraft = (): Draft => ({
  locationId: '',
  contactName: '',
  templateCode: 'empty',
  tailMinutes: 0,
  messages: [],
})
const errors: Record<string, string> = {
  SANDBOX_BUSY: 'Другая переписка ещё обрабатывается. Дождитесь результата и повторите отправку.',
  SANDBOX_LIMIT: 'Исчерпан суточный лимит песочницы. Повторите позже.',
  SANDBOX_AI_BUSY: 'Очередь анализа занята. Повторите отправку позже.',
  SANDBOX_CHANNEL_DISCONNECTED:
    'Канал песочницы отключён. Создайте нового клиента или обратитесь к владельцу.',
  SANDBOX_DELIVERY_UNAVAILABLE: 'Не все сообщения доставлены. Повторите исходную отправку.',
}
export function useSandbox() {
  const session = useSessionStore()
  const client = useQueryClient()
  const tenant = computed(() => session.tenantId)
  const enabled = computed(
    () => session.sandboxEnabled && !!tenant.value && session.can('conversation.read'),
  )
  const identity = computed(() => (enabled.value ? `${session.user!.id}:${tenant.value}` : null))
  const draft = ref<Draft>(emptyDraft())
  const selectedId = ref('')
  const text = ref('')
  const pause = ref('0')
  const validation = ref('')
  const storageError = ref('')
  const draftKey = computed(() =>
    identity.value ? `lidradar:sandbox:draft:${identity.value}` : null,
  )
  let restoringDraft = false
  watch(
    draftKey,
    (key) => {
      restoringDraft = true
      try {
        draft.value = emptyDraft()
        selectedId.value = ''
        text.value = ''
        validation.value = ''
        storageError.value = ''
        if (!key) return
        try {
          const raw = localStorage.getItem(key)
          if (!raw) return
          const saved: unknown = JSON.parse(raw)
          if (isDraft(saved)) draft.value = saved
          else storageError.value = 'Сохранённый черновик повреждён. Создайте его заново.'
        } catch {
          storageError.value = 'Не удалось прочитать черновик в этом браузере.'
        }
      } finally {
        restoringDraft = false
      }
    },
    { immediate: true },
  )
  watch(
    draft,
    (value) => {
      if (!draftKey.value || restoringDraft) return
      try {
        localStorage.setItem(draftKey.value, JSON.stringify(value))
      } catch {
        storageError.value = 'Браузер не сохраняет черновик. Не закрывайте страницу до отправки.'
      }
    },
    { deep: true, flush: 'sync' },
  )
  const locations = useLocationsQuery(computed(() => (enabled.value ? tenant.value : null)))
  const overview = useQuery({
    queryKey: computed(() => [...tenantScope(tenant.value ?? ''), 'sandbox', 'overview']),
    queryFn: ({ signal }) => sandboxApi.overview(tenant.value!, signal),
    enabled,
    retry: false,
  })
  const templates = useQuery({
    queryKey: computed(() => [...tenantScope(tenant.value ?? ''), 'sandbox', 'templates']),
    queryFn: ({ signal }) => sandboxApi.templates(tenant.value!, signal),
    enabled,
    retry: false,
  })
  const list = useQuery({
    queryKey: computed(() => [...tenantScope(tenant.value ?? ''), 'sandbox', 'conversations']),
    queryFn: ({ signal }) => sandboxApi.list(tenant.value!, signal),
    enabled,
    retry: false,
    refetchInterval: 5000,
  })
  const conversations = computed(() => (enabled.value ? (list.data.value?.items ?? []) : []))
  const listedSelection = computed(() =>
    conversations.value.find((item) => item.id === selectedId.value),
  )
  const detail = useQuery({
    queryKey: computed(() => [
      ...tenantScope(tenant.value ?? ''),
      'sandbox',
      'detail',
      selectedId.value,
    ]),
    queryFn: ({ signal }) => sandboxApi.detail(tenant.value!, selectedId.value, signal),
    enabled: computed(() => enabled.value && !!selectedId.value),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status.state === 'PROCESSING' ? 3000 : false),
  })
  const selected = computed(() =>
    enabled.value && selectedId.value ? (detail.data.value ?? listedSelection.value) : undefined,
  )
  const qualified = computed(
    () => templates.data.value?.items.filter((item) => item.qualified) ?? [],
  )
  const pendingScope = (operation: string) =>
    identity.value ? `sandbox:${identity.value}:${operation}` : null
  async function accept(result: Conversation) {
    const tenantId = tenant.value!
    const actor = identity.value
    await Promise.all([
      client.cancelQueries({
        queryKey: [...tenantScope(tenantId), 'sandbox', 'detail', result.id],
        exact: true,
      }),
      client.cancelQueries({
        queryKey: [...tenantScope(tenantId), 'sandbox', 'conversations'],
        exact: true,
      }),
    ])
    if (identity.value !== actor) return
    client.setQueryData([...tenantScope(tenant.value!), 'sandbox', 'detail', result.id], result)
    const key = [...tenantScope(tenant.value!), 'sandbox', 'conversations']
    client.setQueryData<{ items: Conversation[] }>(key, (old) => ({
      items: [result, ...(old?.items ?? []).filter((item) => item.id !== result.id)],
    }))
    selectedId.value = result.id
    await Promise.all([list.refetch(), overview.refetch()])
  }
  const create = useIdempotentMutation<Draft, Conversation>({
    scope: () => pendingScope('create'),
    execute: (body, key) => sandboxApi.create(tenant.value!, body, key),
    onSuccess: async (result) => {
      draft.value = emptyDraft()
      await accept(result)
    },
  })
  const send = useIdempotentMutation<Send, Conversation>({
    scope: () => (selectedId.value ? pendingScope(`send:${selectedId.value}`) : null),
    execute: (body, key) => sandboxApi.send(tenant.value!, selectedId.value, body, key),
    onSuccess: async (result) => {
      text.value = ''
      await accept(result)
    },
  })
  const locked = computed(
    () =>
      create.isPending.value ||
      create.canRetry.value ||
      (!!create.draft.value && ['conflict', 'expired'].includes(create.draft.value.state)),
  )
  const sendLocked = computed(
    () =>
      send.isPending.value ||
      send.canRetry.value ||
      (!!send.draft.value && ['conflict', 'expired'].includes(send.draft.value.state)),
  )
  const maxText = computed(() => overview.data.value?.rules.maxTextLength ?? 4000)
  function applyTemplate(code: string) {
    const template = qualified.value.find((item) => item.code === code)
    if (!template || locked.value) return
    draft.value = {
      ...draft.value,
      templateCode: template.code as Draft['templateCode'],
      tailMinutes: template.tailMinutes,
      messages: template.messages.map((item) => ({ ...item })),
    }
  }
  function newClient() {
    if (!locked.value && !sendLocked.value) {
      selectedId.value = ''
      validation.value = ''
      text.value = ''
    }
  }
  async function add(direction: Send['direction']) {
    validation.value = ''
    const value = text.value.trim()
    if (!value) {
      validation.value = 'Введите текст сообщения'
      return
    }
    if (value.length > maxText.value) {
      validation.value = 'Сообщение слишком длинное'
      return
    }
    if (selected.value) {
      if (!sendLocked.value) {
        send.reset()
        await send.submit({ direction, text: value })
      }
      return
    }
    if (locked.value) return
    if (draft.value.messages.length >= (overview.data.value?.rules.maxMessagesPerBuild ?? 30)) {
      validation.value = 'Достигнут предел сообщений в сборке'
      return
    }
    draft.value.messages.push({ direction, text: value, pauseBeforeMinutes: Number(pause.value) })
    text.value = ''
    pause.value = '0'
  }
  async function submit() {
    validation.value = ''
    if (!draft.value.locationId || !draft.value.messages.length) {
      validation.value = 'Выберите точку и добавьте хотя бы одно сообщение'
      return
    }
    const history =
      draft.value.tailMinutes +
      draft.value.messages.slice(1).reduce((sum, message) => sum + message.pauseBeforeMinutes, 0)
    if (history > (overview.data.value?.rules.maxHistoryMinutes ?? 10080)) {
      validation.value = 'История переписки не должна быть старше 7 суток'
      return
    }
    if (locked.value) return
    create.reset()
    await create.submit(JSON.parse(JSON.stringify(draft.value)) as Draft)
  }
  const error = computed(
    () =>
      create.error.value ??
      send.error.value ??
      detail.error.value ??
      overview.error.value ??
      templates.error.value ??
      locations.error.value ??
      list.error.value,
  )
  const errorText = computed(() =>
    error.value
      ? ((isApiError(error.value) ? errors[error.value.code] : undefined) ??
        describeError(error.value).description)
      : '',
  )
  return {
    session,
    enabled,
    draft,
    selectedId,
    selected,
    text,
    pause,
    validation,
    storageError,
    locations,
    overview,
    templates,
    list,
    detail,
    conversations,
    qualified,
    create,
    send,
    locked,
    sendLocked,
    maxText,
    applyTemplate,
    newClient,
    add,
    submit,
    errorText,
  }
}
function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false
  const d = value as Draft
  return (
    typeof d.locationId === 'string' &&
    typeof d.contactName === 'string' &&
    [
      'empty',
      'no_response',
      'booking_not_confirmed',
      'promise_not_fulfilled',
      'customer_silent_after_price',
      'follow_up_candidate',
      'unfinished_agreement',
    ].includes(d.templateCode) &&
    Number.isFinite(d.tailMinutes) &&
    d.tailMinutes >= 0 &&
    Array.isArray(d.messages) &&
    d.messages.length <= 30 &&
    d.messages.every(
      (m) =>
        m &&
        ['INCOMING', 'OUTGOING'].includes(m.direction) &&
        typeof m.text === 'string' &&
        Number.isFinite(m.pauseBeforeMinutes) &&
        m.pauseBeforeMinutes >= 0,
    )
  )
}
