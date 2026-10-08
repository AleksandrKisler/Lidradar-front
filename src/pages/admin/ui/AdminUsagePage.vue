<script setup lang="ts">
/** Потребление по организациям за окно UTC: даты включительно, по умолчанию 30 дней. */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDateTime } from '@/shared/lib'
import { UiCard, UiEmptyState, UiErrorState, UiField, UiInput, UiSkeleton } from '@/shared/ui'
import {
  defaultUsageRange,
  usageRangeToInstants,
  useUsageQuery,
  validateUsageRange,
  type UsageRange,
} from '@/entities/admin'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'

const route = useRoute()
const router = useRouter()

const range = computed<UsageRange>(() => {
  const from = typeof route.query.from === 'string' ? route.query.from : ''
  const to = typeof route.query.to === 'string' ? route.query.to : ''
  return from || to ? { from, to } : defaultUsageRange()
})
const rangeError = computed(() => validateUsageRange(range.value))
const instants = computed(() => (rangeError.value ? null : usageRangeToInstants(range.value)))
const usage = useUsageQuery(instants)

function setRange(patch: Partial<UsageRange>): void {
  const next = { ...range.value, ...patch }
  void router.replace({ query: { from: next.from, to: next.to } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard>
      <form class="flex flex-wrap items-end gap-4" aria-label="Окно отчёта" @submit.prevent>
        <UiField v-slot="{ id, describedBy, invalid }" label="Начало (UTC)" class="w-44">
          <UiInput
            :id="id"
            :model-value="range.from"
            type="date"
            name="from"
            :described-by="describedBy"
            :invalid="invalid || rangeError !== null"
            @update:model-value="(value) => setRange({ from: value ?? '' })"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Конец (UTC)" class="w-44">
          <UiInput
            :id="id"
            :model-value="range.to"
            type="date"
            name="to"
            :described-by="describedBy"
            :invalid="invalid || rangeError !== null"
            @update:model-value="(value) => setRange({ to: value ?? '' })"
          />
        </UiField>
      </form>
      <p v-if="rangeError" class="mt-2 text-sm text-danger" role="alert">{{ rangeError }}</p>
      <p v-else-if="usage.data.value" class="mt-2 text-xs text-muted">
        Окно по ответу: с {{ formatDateTime(usage.data.value.from, 'UTC') }} до
        {{ formatDateTime(usage.data.value.to, 'UTC') }} UTC (исключительно). Стоимость AI считается
        по числу и длительности прогонов, не по токенам.
      </p>
    </UiCard>
    <SnapshotBar
      :updated-at="usage.dataUpdatedAt.value"
      :loading="usage.isFetching.value"
      @refresh="usage.refetch()"
    />
    <UiCard>
      <div v-if="rangeError" class="text-sm text-muted">Исправьте окно, чтобы увидеть отчёт.</div>
      <div v-else-if="usage.isPending.value" role="status" aria-label="Загрузка потребления">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="usage.isError.value"
        :error="usage.error.value"
        title="Не удалось загрузить потребление"
        @retry="usage.refetch()"
      />
      <UiEmptyState
        v-else-if="usage.data.value?.tenants.length === 0"
        title="За окно активности не было"
      />
      <div
        v-else-if="usage.data.value"
        class="relative overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Таблица потребления"
      >
        <table class="w-full min-w-[1040px] text-left text-sm">
          <caption class="sr-only">
            Потребление по организациям
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted">
              <th scope="col" class="pb-2">Организация</th>
              <th scope="col" class="pb-2 text-right">Сообщений</th>
              <th scope="col" class="pb-2 text-right">Сырых событий</th>
              <th scope="col" class="pb-2 text-right">Заданий</th>
              <th scope="col" class="pb-2 text-right">AI-заданий</th>
              <th scope="col" class="pb-2 text-right">Прогонов</th>
              <th scope="col" class="pb-2 text-right">Применено / отклонено / устарело</th>
              <th scope="col" class="pb-2 text-right">Секунд AI</th>
              <th scope="col" class="pb-2 text-right">Рисков</th>
              <th scope="col" class="pb-2 text-right">Уведомлений / доставок</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="tenant in usage.data.value.tenants" :key="tenant.tenantId">
              <td class="py-2 pr-4">
                <span class="block font-semibold text-ink">{{ tenant.name }}</span
                ><IdCell :value="tenant.tenantId" />
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.messages }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.rawEvents }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.jobs }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.aiJobs }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.aiRuns }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">
                {{ tenant.aiRunsApplied }} / {{ tenant.aiRunsRejected }} / {{ tenant.aiRunsStale }}
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.aiRunSeconds }}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{{ tenant.risks }}</td>
              <td class="py-2 text-right tabular-nums">
                {{ tenant.notifications }} / {{ tenant.deliveries }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
