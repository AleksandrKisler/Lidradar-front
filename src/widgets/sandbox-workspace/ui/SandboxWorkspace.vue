<script setup lang="ts">
/**
 * Рабочая область песочницы (ADR 0066, прототип docs/front-end/mockups/prototypes/sandbox.html): клиенты,
 * переписка и панель «Проверка». Черновик живёт в браузере; после отправки переписка — на сервере, а её
 * сверка перечитывается, пока идёт обработка.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { plural } from '@/shared/lib'
import { UiAlert, UiButton, UiCard, UiEmptyState } from '@/shared/ui'
import { useLocationsQuery } from '@/entities/location'
import {
  TAIL_OPTIONS,
  draftProblem,
  formatMoment,
  formatPause,
  planTimeline,
  useSandboxConversationQuery,
  useSandboxConversationsQuery,
  useSandboxTemplatesQuery,
  type SandboxConversation,
  type SandboxDirection,
} from '@/entities/sandbox'
import {
  addDraftMessage,
  draftFromTemplate,
  editDraftMessage,
  hasModifiedTemplate,
  removeDraftMessage,
  toCreateRequest,
  useCreateSandboxConversation,
  useSandboxDraft,
} from '@/features/sandbox/build-conversation'
import { useSendSandboxMessage } from '@/features/sandbox/send-message'
import { draftTimeline, sandboxErrorText, sentTimeline } from '../model/view'
import SandboxChips from './SandboxChips.vue'
import SandboxCheckPanel from './SandboxCheckPanel.vue'
import SandboxClientList from './SandboxClientList.vue'
import SandboxComposer from './SandboxComposer.vue'
import SandboxNewClientDialog from './SandboxNewClientDialog.vue'
import SandboxTimeline from './SandboxTimeline.vue'

const props = defineProps<{ tenantId: string; timeZone: string; conversationId: string | null }>()
const emit = defineEmits<{ select: [conversationId: string | null] }>()

// Подписи времени и «прошло …» пересчитываются раз в 30 секунд.
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const templates = useSandboxTemplatesQuery(() => props.tenantId)
const conversations = useSandboxConversationsQuery(() => props.tenantId)
const locations = useLocationsQuery(() => props.tenantId)
const selected = useSandboxConversationQuery(
  () => props.tenantId,
  () => props.conversationId,
)
const { draft, update } = useSandboxDraft()
const dialogOpen = ref(false)
const clearComposerToken = ref(0)

const allTemplates = computed(() => templates.data.value ?? [])
const qualifiedTemplates = computed(() => allTemplates.value.filter((item) => item.qualified))
const templateNames = computed(() =>
  Object.fromEntries(allTemplates.value.map((item) => [item.code, item.name])),
)
const locationNames = computed(() =>
  Object.fromEntries((locations.data.value ?? []).map((item) => [item.id, item.name])),
)
const tailOptions = TAIL_OPTIONS.map((value) => ({ value, label: formatPause(value) }))

/** Выбранная отправленная переписка: свежий ответ детали или строка списка, пока деталь грузится. */
const conversation = computed<SandboxConversation | null>(() => {
  if (!props.conversationId) return null
  return (
    selected.data.value ??
    conversations.data.value?.find((item) => item.id === props.conversationId) ??
    null
  )
})
const mode = computed<'live' | 'draft' | 'empty'>(() =>
  props.conversationId ? 'live' : draft.value ? 'draft' : 'empty',
)
const template = computed(() => {
  const code = conversation.value?.templateCode ?? draft.value?.templateCode
  return allTemplates.value.find((item) => item.code === code) ?? null
})
const draftModified = computed(() =>
  draft.value ? hasModifiedTemplate(draft.value, template.value) : false,
)
const items = computed(() => {
  if (mode.value === 'live' && conversation.value)
    return sentTimeline(conversation.value, now.value)
  if (mode.value === 'draft' && draft.value)
    return draftTimeline(draft.value.messages, draft.value.tailMinutes, now.value)
  return []
})

const create = useCreateSandboxConversation((created) => {
  update(null)
  emit('select', created.id)
})
const send = useSendSandboxMessage(
  () => props.conversationId ?? '',
  () => {
    clearComposerToken.value += 1
  },
)

/** Пока результат прошлой отправки неизвестен, черновик не меняется: повтор идёт тем же телом. */
const draftLocked = computed(() => create.isPending.value || create.canRetry.value)
const problem = computed(() =>
  draft.value ? draftProblem(draft.value.messages, draft.value.tailMinutes) : null,
)
const draftSummary = computed(() => {
  if (!draft.value) return ''
  const count = draft.value.messages.length
  const first = planTimeline(draft.value.messages, draft.value.tailMinutes, now.value)[0]
  const noun = plural(count, 'сообщение', 'сообщения', 'сообщений')
  return first
    ? `${count} ${noun} · первое ${formatMoment(first, props.timeZone, now.value).toLowerCase()}`
    : `${count} ${noun}`
})
const headline = computed(() => {
  if (mode.value === 'live' && conversation.value)
    return {
      name: conversation.value.contactName,
      line: `${locationNames.value[conversation.value.locationId] ?? 'Точка'} · ${templateNames.value[conversation.value.templateCode] ?? conversation.value.templateCode}`,
    }
  if (mode.value === 'draft' && draft.value)
    return {
      name: draft.value.contactName || 'Новый клиент',
      line: `${locationNames.value[draft.value.locationId] ?? 'Точка'} · ${templateNames.value[draft.value.templateCode] ?? draft.value.templateCode}`,
    }
  return null
})
const commandError = computed(() => {
  const mutation = mode.value === 'live' ? send : create
  return mutation.status.value === 'error' || mutation.status.value === 'unknown'
    ? sandboxErrorText(mutation.error.value)
    : null
})

function startDraft(templateCode: string, locationId: string, contactName: string): void {
  if (draftLocked.value) return
  const chosen = allTemplates.value.find((item) => item.code === templateCode)
  if (!chosen) return
  update({ ...draftFromTemplate(chosen, locationId), contactName })
  emit('select', null)
}

function onAdd(direction: SandboxDirection, text: string): void {
  if (mode.value === 'draft' && draft.value) {
    update(addDraftMessage(draft.value, direction, text))
    return
  }
  if (mode.value === 'live') {
    void send.submit({ direction, text })
  }
}

function retrySend(): void {
  void send.retry()
}

function retryLoad(): void {
  void templates.refetch()
  void locations.refetch()
  void conversations.refetch()
}

function submitDraft(): void {
  if (!draft.value || problem.value) return
  if (create.canRetry.value) void create.retry()
  else void create.submit(toCreateRequest(draft.value))
}
</script>

<template>
  <div
    class="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px] lg:items-start"
  >
    <SandboxClientList
      :draft="
        draft
          ? {
              name: draft.contactName || 'Новый клиент',
              templateName: templateNames[draft.templateCode] ?? draft.templateCode,
            }
          : null
      "
      :conversations="conversations.data.value ?? []"
      :template-names="templateNames"
      :selected-id="conversationId"
      :draft-selected="mode === 'draft'"
      :create-disabled="draftLocked"
      @select="emit('select', $event)"
      @create="dialogOpen = true"
    />

    <UiAlert
      v-if="templates.isError.value || locations.isError.value || conversations.isError.value"
      tone="danger"
      title="Не удалось загрузить песочницу"
    >
      Повторите загрузку данных.
      <UiButton variant="secondary" @click="retryLoad"> Повторить </UiButton>
    </UiAlert>

    <UiCard v-if="mode === 'empty'" :padded="false">
      <p
        v-if="
          templates.isPending.value || locations.isPending.value || conversations.isPending.value
        "
        class="px-6 pt-5 text-sm text-muted"
      >
        Загружаем песочницу…
      </p>
      <UiEmptyState
        title="Создайте виртуального клиента"
        description="Выберите шаблон: он заполнит переписку. Дальше отправьте её в систему и сверьте найденный риск с ожидаемым."
      >
        <template #actions>
          <UiButton @click="dialogOpen = true">Новый клиент</UiButton>
        </template>
      </UiEmptyState>
    </UiCard>

    <UiCard
      v-else
      as="section"
      :padded="false"
      aria-labelledby="sandbox-thread-title"
      class="flex min-w-0 flex-col"
    >
      <header class="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
        <div class="min-w-0 flex-1">
          <h2 id="sandbox-thread-title" class="truncate text-lg font-semibold text-ink">
            {{ headline?.name }}
          </h2>
          <p class="truncate text-sm text-muted">{{ headline?.line }}</p>
        </div>
      </header>

      <UiAlert
        v-if="mode === 'live' && selected.isError.value"
        tone="danger"
        title="Не удалось загрузить переписку"
      >
        <UiButton variant="secondary" @click="selected.refetch()">Повторить</UiButton>
      </UiAlert>
      <p v-else-if="mode === 'live' && !conversation" class="px-6 pt-5 text-sm text-muted">
        Загружаем переписку…
      </p>

      <div class="px-6 py-5">
        <SandboxTimeline
          :items="items"
          :time-zone="timeZone"
          :now="now"
          :editable="mode === 'draft' && !draftLocked"
          @remove="draft && update(removeDraftMessage(draft, $event))"
          @edit="(index, text) => draft && update(editDraftMessage(draft, index, text))"
        >
          <template v-if="mode === 'draft' && draft" #tail>
            <div class="flex flex-col items-center gap-2 py-1">
              <span class="text-xs text-muted">После последнего сообщения прошло</span>
              <SandboxChips
                label="После последнего сообщения прошло"
                :options="tailOptions"
                :model-value="draft.tailMinutes"
                :disabled="draftLocked"
                @update:model-value="update({ ...draft, tailMinutes: $event })"
              />
            </div>
          </template>
        </SandboxTimeline>
        <p
          v-if="mode === 'draft' && draft && !draft.messages.length"
          class="py-4 text-center text-sm text-muted"
        >
          Переписка пуста. Напишите первое сообщение от клиента ниже.
        </p>
      </div>

      <div class="flex flex-col gap-4 border-t border-line px-6 pt-4 pb-6">
        <UiAlert
          v-if="commandError"
          :tone="send.canRetry.value || create.canRetry.value ? 'warning' : 'danger'"
          :title="commandError.title"
        >
          {{ commandError.description }}
        </UiAlert>
        <UiButton
          v-if="mode === 'live' && send.canRetry.value"
          variant="secondary"
          :loading="send.isPending.value"
          @click="retrySend"
        >
          Повторить отправку
        </UiButton>
        <SandboxComposer
          :key="`${tenantId}:${conversationId ?? 'draft'}`"
          :mode="mode === 'live' ? 'live' : 'draft'"
          :clear-token="clearComposerToken"
          :pause="draft?.nextPause ?? 0"
          :show-pause="mode === 'draft' && Boolean(draft?.messages.length)"
          :busy="send.isPending.value"
          :locked="
            mode === 'draft'
              ? draftLocked
              : send.canRetry.value || send.isPending.value || !conversation
          "
          @add="onAdd"
          @update:pause="draft && update({ ...draft, nextPause: $event })"
        />
      </div>

      <footer
        v-if="mode === 'draft' && draft"
        class="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4"
      >
        <span class="text-sm text-muted">{{ problem ?? draftSummary }}</span>
        <UiButton
          class="ml-auto"
          :disabled="Boolean(problem)"
          :loading="create.isPending.value"
          @click="submitDraft"
        >
          {{ create.canRetry.value ? 'Повторить отправку' : 'Отправить в систему' }}
        </UiButton>
      </footer>
    </UiCard>

    <div v-if="mode !== 'empty'" class="min-w-0 lg:col-start-2 xl:col-start-auto">
      <SandboxCheckPanel
        :expected-risk-type="conversation?.expectedRiskType ?? template?.expectedRiskType ?? null"
        :closed-by="template?.closedBy ?? null"
        :verdict="mode === 'live' ? (conversation?.status ?? null) : null"
        :template-version="conversation?.templateVersion ?? template?.version ?? null"
        :sandbox-id="conversation?.id ?? null"
        :template-modified="
          mode === 'draft' ? draftModified : (conversation?.templateModified ?? null)
        "
        :time-zone="timeZone"
        :now="now"
      />
    </div>

    <SandboxNewClientDialog
      v-if="!draftLocked"
      v-model:open="dialogOpen"
      :templates="qualifiedTemplates"
      :locations="locations.data.value ?? []"
      :replaces-draft="Boolean(draft)"
      @create="startDraft"
    />
  </div>
</template>
