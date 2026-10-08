<script setup lang="ts">
/**
 * AI: узлы, прогоны с фильтрами из адреса и точечный запрос последнего
 * применённого результата переписки. Показываются только метаданные и
 * безопасно сериализованные значения фактов с признаком доверия.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDateTime } from '@/shared/lib'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiInput,
  UiSelect,
  UiSkeleton,
  type UiSelectOption,
} from '@/shared/ui'
import { isApiError } from '@/shared/api'
import {
  ADMIN_LIMITS,
  AI_APPLICATION_STATUSES,
  AI_RUN_STATUSES,
  adminStatusLabel,
  adminStatusTone,
  isUuid,
  safeJson,
  useAINodesQuery,
  useAIRunsQuery,
  useConversationSummaryQuery,
  type AIRunFilters,
} from '@/entities/admin'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'
import { filtersToQuery, parseIdPair, parseRunFilters } from '../model/filters-query'

const route = useRoute()
const router = useRouter()
const filters = computed(() => parseRunFilters(route.query))
const nodes = useAINodesQuery()
const runs = useAIRunsQuery(filters)

const statusOptions: UiSelectOption[] = AI_RUN_STATUSES.map((value) => ({
  value,
  label: adminStatusLabel(value),
}))
const applicationOptions: UiSelectOption[] = AI_APPLICATION_STATUSES.map((value) => ({
  value,
  label: adminStatusLabel(value),
}))
const limitOptions: UiSelectOption[] = ADMIN_LIMITS.map((value) => ({
  value: String(value),
  label: String(value),
}))

function update(patch: Partial<Record<keyof AIRunFilters, string | undefined>>): void {
  const current = parseIdPair(route.query, 'summaryTenantId', 'conversationId') ?? {}
  void router.replace({ query: { ...filtersToQuery({ ...filters.value, ...patch }), ...current } })
}

// Резюме переписки: пара идентификаторов в адресе, запрос только по явной отправке.
const summaryParams = computed(() => {
  const pair = parseIdPair(route.query, 'summaryTenantId', 'conversationId')
  return pair ? { tenantId: pair.summaryTenantId!, conversationId: pair.conversationId! } : null
})
const summary = useConversationSummaryQuery(summaryParams)
const draftTenant = ref(summaryParams.value?.tenantId ?? '')
const draftConversation = ref(summaryParams.value?.conversationId ?? '')
const lookupError = computed(() =>
  draftTenant.value &&
  draftConversation.value &&
  (!isUuid(draftTenant.value) || !isUuid(draftConversation.value))
    ? 'Оба идентификатора должны быть UUID'
    : null,
)
function lookup(): void {
  if (lookupError.value || !draftTenant.value || !draftConversation.value) return
  void router.replace({
    query: {
      ...filtersToQuery(filters.value),
      summaryTenantId: draftTenant.value.trim(),
      conversationId: draftConversation.value.trim(),
    },
  })
}
const summaryNotFound = computed(
  () => isApiError(summary.error.value) && summary.error.value.httpStatus === 404,
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard as="section" aria-labelledby="nodes-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="nodes-title" class="text-lg font-bold text-ink">Узлы</h2>
        <SnapshotBar
          :updated-at="nodes.dataUpdatedAt.value"
          :loading="nodes.isFetching.value"
          @refresh="nodes.refetch()"
        />
      </div>
      <div v-if="nodes.isPending.value" class="mt-4" role="status" aria-label="Загрузка узлов">
        <UiSkeleton class="h-16 w-full" />
      </div>
      <UiErrorState
        v-else-if="nodes.isError.value"
        class="mt-4"
        :error="nodes.error.value"
        title="Не удалось загрузить узлы"
        @retry="nodes.refetch()"
      />
      <UiEmptyState v-else-if="nodes.data.value?.length === 0" title="Узлов пока нет" />
      <ul v-else-if="nodes.data.value" class="mt-4 divide-y divide-line" aria-label="AI-узлы">
        <li
          v-for="node in nodes.data.value"
          :key="node.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-ink">{{ node.name }}</span
              ><UiBadge :tone="adminStatusTone(node.status)">{{
                adminStatusLabel(node.status)
              }}</UiBadge>
            </div>
            <p class="mt-1 text-xs text-muted">
              Узел <IdCell :value="node.id" /> · модель {{ node.modelVersion ?? '—' }} · слотов
              {{ node.availableSlots }} · в работе {{ node.inflight }} · организаций
              {{ node.tenants.length }} · пульс
              {{ node.lastHeartbeatAt ? formatDateTime(node.lastHeartbeatAt, 'UTC') : '—' }}
            </p>
          </div>
        </li>
      </ul>
    </UiCard>

    <UiCard as="section" aria-labelledby="runs-title">
      <h2 id="runs-title" class="text-lg font-bold text-ink">Прогоны</h2>
      <form class="mt-4 grid gap-4 sm:grid-cols-4" aria-label="Фильтры прогонов" @submit.prevent>
        <UiField v-slot="{ id, describedBy, invalid }" label="Организация (UUID)">
          <UiInput
            :id="id"
            :model-value="filters.tenantId ?? ''"
            name="runTenantId"
            :described-by="describedBy"
            :invalid="invalid"
            @change="
              (event: Event) =>
                update({ tenantId: (event.target as HTMLInputElement).value.trim() || undefined })
            "
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Статус">
          <UiSelect
            :id="id"
            :model-value="filters.status ?? ''"
            name="runStatus"
            placeholder="Любой"
            :options="statusOptions"
            :described-by="describedBy"
            :invalid="invalid"
            @update:model-value="(value) => update({ status: value || undefined })"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Применение">
          <UiSelect
            :id="id"
            :model-value="filters.applicationStatus ?? ''"
            name="applicationStatus"
            placeholder="Любое"
            :options="applicationOptions"
            :described-by="describedBy"
            :invalid="invalid"
            @update:model-value="(value) => update({ applicationStatus: value || undefined })"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Лимит">
          <UiSelect
            :id="id"
            :model-value="String(filters.limit)"
            name="runLimit"
            :options="limitOptions"
            :described-by="describedBy"
            :invalid="invalid"
            @update:model-value="(value) => update({ limit: value })"
          />
        </UiField>
      </form>
      <div class="mt-4">
        <SnapshotBar
          :updated-at="runs.dataUpdatedAt.value"
          :loading="runs.isFetching.value"
          @refresh="runs.refetch()"
        />
      </div>
      <div v-if="runs.isPending.value" class="mt-4" role="status" aria-label="Загрузка прогонов">
        <UiSkeleton class="h-16 w-full" />
      </div>
      <UiErrorState
        v-else-if="runs.isError.value"
        class="mt-4"
        :error="runs.error.value"
        title="Не удалось загрузить прогоны"
        @retry="runs.refetch()"
      />
      <UiEmptyState v-else-if="runs.data.value?.length === 0" title="Прогонов по фильтру нет" />
      <div
        v-else-if="runs.data.value"
        class="mt-4 relative overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Таблица прогонов"
      >
        <table class="w-full min-w-[960px] text-left text-sm">
          <caption class="sr-only">
            Прогоны
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted">
              <th scope="col" class="pb-2">Прогон</th>
              <th scope="col" class="pb-2">Организация · переписка</th>
              <th scope="col" class="pb-2">Статус</th>
              <th scope="col" class="pb-2">Применение</th>
              <th scope="col" class="pb-2">Версии</th>
              <th scope="col" class="pb-2">Ошибка</th>
              <th scope="col" class="pb-2">Начат</th>
              <th scope="col" class="pb-2 text-right">Длительность</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="run in runs.data.value" :key="run.id">
              <td class="py-2 pr-4"><IdCell :value="run.id" /></td>
              <td class="py-2 pr-4">
                <IdCell :value="run.tenantId" /> · <IdCell :value="run.conversationId" />
              </td>
              <td class="py-2 pr-4">
                <UiBadge :tone="adminStatusTone(run.status)">{{
                  adminStatusLabel(run.status)
                }}</UiBadge>
              </td>
              <td class="py-2 pr-4">
                <UiBadge :tone="adminStatusTone(run.applicationStatus)">{{
                  adminStatusLabel(run.applicationStatus)
                }}</UiBadge>
              </td>
              <td class="py-2 pr-4 text-xs text-muted">
                {{ run.modelVersion }} · промпт {{ run.promptVersion }} · схема
                {{ run.schemaVersion }}
              </td>
              <td class="py-2 pr-4">
                <code class="text-xs">{{ run.errorCode ?? '—' }}</code
                ><span v-if="run.validationError" class="block text-xs text-muted">{{
                  safeJson(run.validationError, 80)
                }}</span>
              </td>
              <td class="py-2 pr-4 text-muted">{{ formatDateTime(run.startedAt, 'UTC') }}</td>
              <td class="py-2 text-right tabular-nums">
                {{ run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)} с` : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <UiCard as="section" aria-labelledby="summary-title">
      <h2 id="summary-title" class="text-lg font-bold text-ink">Результат анализа переписки</h2>
      <p class="mt-1 text-sm text-muted">
        Последний применённый результат: факты с признаком доверия и ссылками на
        сообщения-доказательства. Текста переписки и резюме здесь нет.
      </p>
      <form
        class="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        aria-label="Поиск результата"
        @submit.prevent="lookup"
      >
        <UiField v-slot="{ id, describedBy, invalid }" label="Организация (UUID)">
          <UiInput
            :id="id"
            v-model="draftTenant"
            name="summaryTenantId"
            :described-by="describedBy"
            :invalid="invalid || lookupError !== null"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Переписка (UUID)">
          <UiInput
            :id="id"
            v-model="draftConversation"
            name="summaryConversationId"
            :described-by="describedBy"
            :invalid="invalid || lookupError !== null"
          />
        </UiField>
        <UiButton
          type="submit"
          :disabled="!draftTenant || !draftConversation || lookupError !== null"
          >Показать</UiButton
        >
      </form>
      <p v-if="lookupError" class="mt-2 text-sm text-danger" role="alert">{{ lookupError }}</p>
      <div
        v-if="summary.isFetching.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка результата"
      >
        <UiSkeleton class="h-16 w-full" />
      </div>
      <UiAlert v-else-if="summaryNotFound" class="mt-4" tone="info" title="Результата нет"
        >Для этой переписки применённого результата анализа нет.</UiAlert
      >
      <UiErrorState
        v-else-if="summary.isError.value"
        class="mt-4"
        :error="summary.error.value"
        title="Не удалось загрузить результат"
        @retry="summary.refetch()"
      />
      <div
        v-else-if="summary.data.value"
        class="mt-4 flex flex-col gap-3"
        data-testid="conversation-summary"
      >
        <p class="text-xs text-muted">
          Ревизия {{ summary.data.value.revision }} · до сообщения
          <IdCell :value="summary.data.value.analysisThroughMessageId" /> · прогон
          <IdCell :value="summary.data.value.aiRunId" /> · {{ summary.data.value.modelVersion }} ·
          обновлено {{ formatDateTime(summary.data.value.updatedAt, 'UTC') }} · доверенных
          {{ summary.data.value.trustedFacts }}, слабых {{ summary.data.value.weakFacts }}
        </p>
        <UiEmptyState v-if="summary.data.value.facts.length === 0" title="Фактов нет" />
        <ul v-else class="divide-y divide-line" aria-label="Факты">
          <li
            v-for="(fact, index) in summary.data.value.facts"
            :key="`${fact.type}-${index}`"
            class="flex flex-wrap items-start justify-between gap-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-ink">{{ fact.type }}</span
                ><UiBadge :tone="fact.trusted ? 'success' : 'warning'">{{
                  fact.trusted ? 'доверенный' : 'слабый'
                }}</UiBadge
                ><span class="text-xs text-muted"
                  >уверенность {{ Math.round(fact.confidence * 100) }} %</span
                >
              </div>
              <code class="mt-1 block text-xs break-all text-ink">{{
                safeJson(fact.value, 200)
              }}</code>
              <p class="mt-1 text-xs text-muted">
                Доказательства:
                <template v-if="fact.evidenceMessageIds.length"
                  ><IdCell v-for="id in fact.evidenceMessageIds" :key="id" :value="id" /></template
                ><template v-else>нет</template>
              </p>
            </div>
          </li>
        </ul>
      </div>
    </UiCard>
  </div>
</template>
