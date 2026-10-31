<script setup lang="ts">
import { computed } from 'vue'
import { riskTypeLabel, riskStatusLabel } from '@/entities/risk'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiField,
  UiInput,
  UiPageHeader,
  UiSelect,
  UiTextarea,
} from '@/shared/ui'
import { useSandbox } from '../model/use-sandbox'

const {
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
} = useSandbox()
const locationOptions = computed(() =>
  (locations.data.value ?? [])
    .filter((item) => item.active)
    .map((item) => ({ value: item.id, label: item.name })),
)
const templateOptions = computed(() =>
  qualified.value.map((item) => ({ value: item.code, label: item.name })),
)
const templateCode = computed({
  get: () => draft.value.templateCode,
  set: (value: string | undefined) => applyTemplate(value ?? ''),
})
const tail = computed({
  get: () => String(draft.value.tailMinutes),
  set: (value: string | undefined) => {
    draft.value.tailMinutes = Number(value ?? 0)
  },
})
const template = computed(() =>
  qualified.value.find((item) => item.code === draft.value.templateCode),
)
const expected = computed(
  () =>
    selected.value?.expectedRiskType ?? (!selected.value ? template.value?.expectedRiskType : null),
)
const messages = computed(() => selected.value?.messages ?? draft.value.messages)
const verdicts = {
  PROCESSING: 'Обработка',
  MATCH: 'Совпало с ожиданием',
  PENDING: 'Риск ещё не наступил',
  CLOSED: 'Риск закрыт',
  MISMATCH: 'Не совпало с ожиданием',
  NO_EXPECTATION: 'Без ожидаемого риска',
  FAILED: 'Ошибка обработки',
} as const
const stages = {
  SENDING: 'Доставка сообщений',
  NORMALIZING: 'Сборка переписки',
  ANALYZING: 'Анализ переписки',
  EVALUATING: 'Проверка правил рисков',
} as const
const pauses = [
  { value: '0', label: 'Нет' },
  { value: '10', label: '10 мин' },
  { value: '60', label: '1 ч' },
  { value: '1440', label: '1 сутки' },
]
const tails = [
  { value: '0', label: 'Нет' },
  { value: '60', label: '1 час' },
  { value: '1440', label: '1 сутки' },
  { value: '7200', label: '5 суток' },
]
const commandLocked = computed(() =>
  selectedId.value ? sendLocked.value || !selected.value : locked.value,
)
function selectClient(id: string) {
  selectedId.value = id
  validation.value = ''
  text.value = ''
}
function refreshData() {
  void overview.refetch()
  void templates.refetch()
  void locations.refetch()
  void list.refetch()
  if (selectedId.value) void detail.refetch()
}
function date(value: string) {
  return new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6">
    <UiPageHeader
      title="Песочница"
      subtitle="Соберите переписку за клиента и бизнес и проверьте, какой риск найдёт Radar."
    />
    <UiAlert v-if="!enabled" title="Песочница недоступна">
      Песочница доступна только в тестовом окружении. На localhost запустите приложение командой npm
      run dev:stage.
    </UiAlert>
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <UiBadge tone="warning">Только стейдж</UiBadge>
          <p v-if="overview.data.value" class="text-sm text-secondary">
            За сутки: {{ overview.data.value.usage.conversations }} из
            {{ overview.data.value.limits.conversationsPerDay }} переписок,
            {{ overview.data.value.usage.messages }} из
            {{ overview.data.value.limits.messagesPerDay }} сообщений
          </p>
          <p v-else class="text-sm text-muted">Лимиты загружаются…</p>
        </div>
        <UiButton variant="secondary" :disabled="locked || sendLocked" @click="newClient"
          >Новый клиент</UiButton
        >
      </div>
      <UiAlert
        v-if="errorText || create.canRetry.value || send.canRetry.value"
        tone="danger"
        title="Не удалось завершить операцию"
      >
        {{
          errorText || 'Результат предыдущей отправки неизвестен. Повторите её с прежними данными.'
        }}
        <div class="mt-3 flex flex-wrap gap-2">
          <UiButton
            v-if="create.canRetry.value"
            variant="secondary"
            :loading="create.isPending.value"
            @click="create.retry()"
            >Повторить отправку</UiButton
          >
          <UiButton
            v-if="send.canRetry.value"
            variant="secondary"
            :loading="send.isPending.value"
            @click="send.retry()"
            >Повторить сообщение</UiButton
          >
          <UiButton variant="secondary" @click="refreshData">Обновить данные</UiButton>
        </div>
      </UiAlert>
      <UiAlert v-if="storageError" tone="warning">{{ storageError }}</UiAlert>
      <div
        class="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_280px]"
      >
        <UiCard class="min-w-0" :padded="false">
          <div class="border-b border-line p-4">
            <h2 class="text-base font-semibold">Виртуальные клиенты</h2>
          </div>
          <div class="flex max-h-80 flex-col gap-1 overflow-y-auto p-2 xl:max-h-[600px]">
            <button
              type="button"
              class="rounded-control p-3 text-left text-sm hover:bg-segment"
              :class="!selectedId ? 'bg-action-pale' : ''"
              :aria-pressed="!selectedId"
              @click="newClient"
            >
              <span class="block font-medium break-words">{{
                draft.contactName || 'Новый клиент'
              }}</span
              ><span class="text-muted">Черновик</span>
            </button>
            <p v-if="list.isPending.value" class="p-3 text-sm text-muted">Переписки загружаются…</p>
            <button
              v-for="item in conversations"
              :key="item.id"
              type="button"
              class="rounded-control p-3 text-left text-sm hover:bg-segment"
              :class="selectedId === item.id ? 'bg-action-pale' : ''"
              :aria-pressed="selectedId === item.id"
              :disabled="create.isPending.value || sendLocked"
              @click="selectClient(item.id)"
            >
              <span class="block font-medium break-words">{{ item.contactName }}</span
              ><span class="text-muted">{{ verdicts[item.status.state] }}</span>
            </button>
          </div>
        </UiCard>
        <UiCard class="flex min-w-0 flex-col gap-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-xl font-semibold break-words">
              {{ selected?.contactName || draft.contactName || 'Новая переписка' }}
            </h2>
            <UiBadge>{{ selected ? verdicts[selected.status.state] : 'Черновик' }}</UiBadge>
          </div>
          <template v-if="!selectedId">
            <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <UiField v-slot="field" label="Точка" required
                ><UiSelect
                  v-bind="field"
                  v-model="draft.locationId"
                  class="min-w-0 max-w-full truncate"
                  :disabled="locked"
                  :options="locationOptions"
                  placeholder="Выберите точку"
              /></UiField>
              <UiField v-slot="field" label="Имя клиента"
                ><UiInput
                  v-bind="field"
                  v-model="draft.contactName"
                  :disabled="locked"
                  :maxlength="120"
                  placeholder="Виртуальный клиент"
              /></UiField>
            </div>
            <UiField v-slot="field" label="Шаблон переписки"
              ><UiSelect
                v-bind="field"
                v-model="templateCode"
                class="min-w-0 max-w-full truncate"
                :disabled="locked || templates.isPending.value"
                :options="templateOptions"
                placeholder="Выберите шаблон"
            /></UiField>
            <UiField v-slot="field" label="После последнего сообщения прошло"
              ><UiSelect
                v-bind="field"
                v-model="tail"
                class="min-w-0 max-w-full truncate"
                :disabled="locked"
                :options="tails"
            /></UiField>
          </template>
          <UiEmptyState
            v-if="!messages.length"
            title="Переписка пуста"
            description="Напишите первое сообщение от клиента ниже."
          />
          <ol v-else aria-label="Сообщения переписки" class="flex min-w-0 flex-col gap-4">
            <li
              v-for="(message, index) in messages"
              :key="index"
              class="flex min-w-0 flex-col gap-1"
              :class="message.direction === 'OUTGOING' ? 'items-end' : 'items-start'"
            >
              <p
                v-if="
                  !selected &&
                  index > 0 &&
                  'pauseBeforeMinutes' in message &&
                  message.pauseBeforeMinutes
                "
                class="self-center text-xs text-muted"
              >
                Прошло {{ message.pauseBeforeMinutes }} мин
              </p>
              <div
                class="max-w-[92%] rounded-control px-4 py-3"
                :class="message.direction === 'OUTGOING' ? 'bg-brand-pale' : 'bg-panel'"
              >
                <p class="mb-1 text-xs font-medium text-secondary">
                  {{ message.direction === 'INCOMING' ? 'Клиент' : 'Бизнес' }}
                </p>
                <p class="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {{ message.text }}
                </p>
              </div>
              <p v-if="'sentAt' in message" class="text-xs text-muted">
                {{ date(message.sentAt) }} · отправлено
              </p>
              <UiButton
                v-if="!selectedId"
                variant="plain"
                size="sm"
                :disabled="locked"
                :aria-label="`Удалить сообщение ${index + 1}`"
                @click="draft.messages.splice(index, 1)"
                >Удалить</UiButton
              >
            </li>
          </ol>
          <div class="flex flex-col gap-4 border-t border-line pt-5">
            <UiField v-if="!selectedId" v-slot="field" label="Пауза перед сообщением"
              ><UiSelect
                v-bind="field"
                v-model="pause"
                class="min-w-0 max-w-full truncate"
                :disabled="locked"
                :options="pauses"
            /></UiField>
            <UiField
              v-slot="field"
              label="Сообщение"
              :error="validation"
              description="Выберите, от чьего имени отправить: «От клиента» или «От бизнеса»."
              ><UiTextarea
                v-bind="field"
                v-model="text"
                :disabled="commandLocked"
                :maxlength="maxText"
                placeholder="Напишите сообщение…"
            /></UiField>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <UiButton
                :disabled="commandLocked"
                :loading="send.isPending.value"
                @click="add('INCOMING')"
                >От клиента</UiButton
              >
              <UiButton variant="secondary" :disabled="commandLocked" @click="add('OUTGOING')"
                >От бизнеса</UiButton
              >
            </div>
            <template v-if="!selectedId">
              <UiButton
                :disabled="
                  locked || !draft.messages.length || !draft.locationId || !overview.data.value
                "
                :loading="create.isPending.value"
                @click="submit"
                >Отправить в систему</UiButton
              >
              <p v-if="!draft.messages.length" class="text-xs text-muted">
                Добавьте хотя бы одно сообщение
              </p>
            </template>
          </div>
        </UiCard>
        <UiCard class="flex min-w-0 flex-col gap-4 xl:col-start-2 2xl:col-start-auto">
          <h2 class="text-xl font-semibold">Проверка</h2>
          <div>
            <p class="text-xs text-muted">Ожидаемый риск</p>
            <p class="mt-1 text-sm font-medium">
              {{ expected ? riskTypeLabel(expected) : 'Без ожидания' }}
            </p>
          </div>
          <p v-if="!selected" class="text-sm text-secondary">
            Отправьте переписку в систему. Сообщения пройдут обычную обработку, и здесь появится
            результат.
          </p>
          <template v-else>
            <p role="status" class="text-base font-semibold">
              {{ verdicts[selected.status.state] }}
            </p>
            <p v-if="selected.status.stage" class="text-sm text-muted">
              {{ stages[selected.status.stage] }}
            </p>
            <p v-if="selected.status.dueAt" class="text-sm text-secondary">
              Срок проверки: {{ date(selected.status.dueAt) }} МСК
            </p>
            <p v-if="selected.status.failureCode" class="text-sm text-danger">
              Не удалось обработать переписку. Обратитесь к администратору тестового окружения.
            </p>
            <ul class="flex flex-col gap-3">
              <li v-for="risk in selected.status.found" :key="risk.id" class="text-sm">
                <RouterLink :to="`/risks/${risk.id}`" class="font-medium text-link hover:underline"
                  >{{ riskTypeLabel(risk.type) }} →</RouterLink
                >
                <p class="mt-1 text-muted">{{ riskStatusLabel(risk.status) }}</p>
              </li>
            </ul>
            <RouterLink
              v-if="selected.status.conversationId"
              :to="`/conversations/${selected.status.conversationId}`"
              class="text-sm font-medium text-link hover:underline"
              >Открыть в «Диалогах» →</RouterLink
            >
            <UiButton
              variant="secondary"
              :loading="detail.isFetching.value"
              @click="detail.refetch()"
              >Проверить результат</UiButton
            >
          </template>
        </UiCard>
      </div>
    </template>
  </div>
</template>
