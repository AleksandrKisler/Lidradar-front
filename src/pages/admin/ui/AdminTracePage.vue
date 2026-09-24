<script setup lang="ts">
/**
 * Трассировка сообщения: цепочка метаданных от сообщения до выручки. Текста
 * сообщения, промптов и сырого вывода модели в контракте нет намеренно.
 * Отсутствующий сегмент отличается от ошибки запроса.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { describeError, isApiError } from '@/shared/api'
import { formatDateTime, formatMoney } from '@/shared/lib'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiCard,
  UiErrorState,
  UiField,
  UiInput,
  UiSkeleton,
} from '@/shared/ui'
import {
  adminStatusLabel,
  adminStatusTone,
  deliveryChannelLabel,
  isUuid,
  safeJson,
  useTraceQuery,
} from '@/entities/admin'
import { severityLabel, riskStatusLabel, riskTypeLabel } from '@/entities/risk'
import { IdCell } from '@/widgets/admin-shell'
import { parseIdPair } from '../model/filters-query'

const route = useRoute()
const router = useRouter()
const params = computed(() => {
  const pair = parseIdPair(route.query, 'tenantId', 'messageId')
  return pair ? { tenantId: pair.tenantId!, messageId: pair.messageId! } : null
})
const trace = useTraceQuery(params)
const draftTenant = ref(params.value?.tenantId ?? '')
const draftMessage = ref(params.value?.messageId ?? '')
const formError = computed(() =>
  draftTenant.value &&
  draftMessage.value &&
  (!isUuid(draftTenant.value) || !isUuid(draftMessage.value))
    ? 'Оба идентификатора должны быть UUID'
    : null,
)
function lookup(): void {
  if (formError.value || !draftTenant.value || !draftMessage.value) return
  void router.replace({
    query: { tenantId: draftTenant.value.trim(), messageId: draftMessage.value.trim() },
  })
}
const notFound = computed(
  () => isApiError(trace.error.value) && trace.error.value.httpStatus === 404,
)
const errorView = computed(() =>
  trace.error.value && !notFound.value ? describeError(trace.error.value) : null,
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard>
      <form
        class="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        aria-label="Поиск трассы"
        @submit.prevent="lookup"
      >
        <UiField v-slot="{ id, describedBy, invalid }" label="Организация (UUID)">
          <UiInput
            :id="id"
            v-model="draftTenant"
            name="traceTenantId"
            :described-by="describedBy"
            :invalid="invalid || formError !== null"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Сообщение (UUID)">
          <UiInput
            :id="id"
            v-model="draftMessage"
            name="traceMessageId"
            :described-by="describedBy"
            :invalid="invalid || formError !== null"
          />
        </UiField>
        <UiButton type="submit" :disabled="!draftTenant || !draftMessage || formError !== null"
          >Построить трассу</UiButton
        >
      </form>
      <p v-if="formError" class="mt-2 text-sm text-danger" role="alert">{{ formError }}</p>
      <p v-else class="mt-2 text-xs text-muted">
        В трассе только метаданные: идентификаторы, статусы, коды ошибок, суммы. Текст сообщения и
        вывод модели не запрашиваются.
      </p>
    </UiCard>

    <div v-if="trace.isFetching.value" role="status" aria-label="Загрузка трассы">
      <UiSkeleton class="h-24 w-full" />
    </div>
    <UiAlert v-else-if="notFound" tone="info" title="Сообщение не найдено"
      >Проверьте организацию и идентификатор сообщения.</UiAlert
    >
    <UiErrorState
      v-else-if="errorView"
      :error="trace.error.value"
      title="Не удалось построить трассу"
      @retry="trace.refetch()"
    />
    <template v-else-if="trace.data.value">
      <UiCard as="section" aria-labelledby="trace-message">
        <h2 id="trace-message" class="text-lg font-bold text-ink">Сообщение</h2>
        <p class="mt-2 text-sm text-muted">
          <IdCell :value="trace.data.value.message.id" /> ·
          {{ trace.data.value.message.direction }} · {{ trace.data.value.message.type }} · переписка
          <IdCell :value="trace.data.value.message.conversationId" /> · подключение
          <IdCell :value="trace.data.value.message.connectionId" /> · отправлено
          {{ formatDateTime(trace.data.value.message.sentAt, 'UTC') }} · получено
          {{ formatDateTime(trace.data.value.message.receivedAt, 'UTC') }}
        </p>
      </UiCard>

      <UiCard as="section" aria-labelledby="trace-jobs">
        <h2 id="trace-jobs" class="text-lg font-bold text-ink">Обработка</h2>
        <p
          v-if="
            trace.data.value.jobs.length === 0 &&
            trace.data.value.aiJobs.length === 0 &&
            trace.data.value.aiRuns.length === 0
          "
          class="mt-2 text-sm text-muted"
        >
          Заданий и прогонов по этому сообщению нет.
        </p>
        <ul v-else class="mt-3 divide-y divide-line text-sm" aria-label="Шаги обработки">
          <li
            v-for="job in trace.data.value.jobs"
            :key="job.id"
            class="flex flex-wrap items-center gap-2 py-2"
          >
            <span class="text-muted">Задание</span><IdCell :value="job.id" /><span
              class="text-ink"
              >{{ job.type }}</span
            ><UiBadge :tone="adminStatusTone(job.status)">{{
              adminStatusLabel(job.status)
            }}</UiBadge
            ><span class="text-xs text-muted">{{ formatDateTime(job.createdAt, 'UTC') }}</span>
          </li>
          <li
            v-for="job in trace.data.value.aiJobs"
            :key="job.id"
            class="flex flex-wrap items-center gap-2 py-2"
          >
            <span class="text-muted">AI-задание</span><IdCell :value="job.id" /><span
              class="text-ink"
              >{{ job.modelRequirement }}</span
            ><UiBadge :tone="adminStatusTone(job.status)">{{
              adminStatusLabel(job.status)
            }}</UiBadge
            ><code v-if="job.lastErrorCode" class="text-xs">{{ job.lastErrorCode }}</code>
          </li>
          <li
            v-for="run in trace.data.value.aiRuns"
            :key="run.id"
            class="flex flex-wrap items-center gap-2 py-2"
          >
            <span class="text-muted">Прогон</span><IdCell :value="run.id" /><UiBadge
              :tone="adminStatusTone(run.status)"
              >{{ adminStatusLabel(run.status) }}</UiBadge
            ><UiBadge :tone="adminStatusTone(run.applicationStatus)">{{
              adminStatusLabel(run.applicationStatus)
            }}</UiBadge
            ><span class="text-xs text-muted"
              >{{ run.modelVersion }} · {{ formatDateTime(run.startedAt, 'UTC') }}</span
            >
          </li>
        </ul>
      </UiCard>

      <UiCard as="section" aria-labelledby="trace-semantic">
        <h2 id="trace-semantic" class="text-lg font-bold text-ink">Результат анализа</h2>
        <p v-if="!trace.data.value.semanticResult" class="mt-2 text-sm text-muted">
          Применённого результата нет.
        </p>
        <ul v-else class="mt-3 divide-y divide-line text-sm" aria-label="Факты">
          <li
            v-for="(fact, index) in trace.data.value.semanticResult.facts"
            :key="`${fact.type}-${index}`"
            class="py-2"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-ink">{{ fact.type }}</span
              ><UiBadge :tone="fact.trusted ? 'success' : 'warning'">{{
                fact.trusted ? 'доверенный' : 'слабый'
              }}</UiBadge
              ><span class="text-xs text-muted"
                >уверенность {{ Math.round(fact.confidence * 100) }} %</span
              >
            </div>
            <code class="mt-1 block text-xs break-all">{{ safeJson(fact.value, 200) }}</code>
          </li>
        </ul>
      </UiCard>

      <UiCard as="section" aria-labelledby="trace-business">
        <h2 id="trace-business" class="text-lg font-bold text-ink">Бизнес-артефакты</h2>
        <div class="mt-3 grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <h3 class="font-semibold text-ink">Риски</h3>
            <p v-if="trace.data.value.risks.length === 0" class="text-muted">Нет</p>
            <ul v-else class="mt-1 flex flex-col gap-1" aria-label="Риски">
              <li
                v-for="risk in trace.data.value.risks"
                :key="risk.id"
                class="flex flex-wrap items-center gap-2"
              >
                <IdCell :value="risk.id" /><span class="text-ink">{{
                  riskTypeLabel(risk.type)
                }}</span
                ><span class="text-muted">{{ severityLabel(risk.severity) }}</span
                ><UiBadge tone="neutral">{{ riskStatusLabel(risk.status) }}</UiBadge
                ><span class="text-xs text-muted">{{
                  formatDateTime(risk.detectedAt, 'UTC')
                }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-ink">Уведомления</h3>
            <p v-if="trace.data.value.notifications.length === 0" class="text-muted">Нет</p>
            <ul v-else class="mt-1 flex flex-col gap-1" aria-label="Уведомления">
              <li
                v-for="item in trace.data.value.notifications"
                :key="item.id"
                class="flex flex-wrap items-center gap-2"
              >
                <IdCell :value="item.id" /><span class="text-ink">{{ item.kind }}</span
                ><span
                  v-for="delivery in item.deliveries"
                  :key="delivery.id"
                  class="text-xs text-muted"
                  >{{ deliveryChannelLabel(delivery.channel) }}:
                  {{ adminStatusLabel(delivery.status) }}</span
                >
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-ink">Действия и исходы</h3>
            <p
              v-if="trace.data.value.actions.length === 0 && trace.data.value.outcomes.length === 0"
              class="text-muted"
            >
              Нет
            </p>
            <ul v-else class="mt-1 flex flex-col gap-1" aria-label="Действия и исходы">
              <li
                v-for="action in trace.data.value.actions"
                :key="action.id"
                class="flex flex-wrap items-center gap-2"
              >
                <span class="text-muted">Действие</span><IdCell :value="action.id" /><span
                  class="text-ink"
                  >{{ action.type }}</span
                ><span class="text-xs text-muted">{{
                  formatDateTime(action.createdAt, 'UTC')
                }}</span>
              </li>
              <li
                v-for="outcome in trace.data.value.outcomes"
                :key="outcome.id"
                class="flex flex-wrap items-center gap-2"
              >
                <span class="text-muted">Исход</span><IdCell :value="outcome.id" /><span
                  class="text-ink"
                  >{{ outcome.status }}</span
                ><span class="text-xs text-muted">{{
                  formatDateTime(outcome.createdAt, 'UTC')
                }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-ink">Выручка</h3>
            <p v-if="trace.data.value.revenue.length === 0" class="text-muted">Нет</p>
            <ul v-else class="mt-1 flex flex-col gap-1" aria-label="Выручка">
              <li
                v-for="event in trace.data.value.revenue"
                :key="event.eventId"
                class="flex flex-wrap items-center gap-2"
              >
                <IdCell :value="event.eventId" /><span class="font-semibold text-ink">{{
                  formatMoney(event.amount, event.currency)
                }}</span
                ><span class="text-muted">{{ event.attribution ?? '—' }}</span
                ><span class="text-xs text-muted">{{
                  formatDateTime(event.confirmedAt, 'UTC')
                }}</span>
              </li>
            </ul>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>
