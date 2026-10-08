<script setup lang="ts">
/** Задания фоновой очереди с фильтрами из адреса и ограничением по лимиту. */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDateTime } from '@/shared/lib'
import {
  UiBadge,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiInput,
  UiSelect,
  UiSkeleton,
  type UiSelectOption,
} from '@/shared/ui'
import {
  ADMIN_LIMITS,
  JOB_STATUSES,
  adminStatusLabel,
  adminStatusTone,
  safeJson,
  useAdminJobsQuery,
  type JobFilters,
} from '@/entities/admin'
import { RecoveryActions } from '@/features/admin/recover-dead-letter'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'
import { filtersToQuery, parseJobFilters } from '../model/filters-query'

const route = useRoute()
const router = useRouter()
const filters = computed(() => parseJobFilters(route.query))
const jobs = useAdminJobsQuery(filters)

const statusOptions: UiSelectOption[] = JOB_STATUSES.map((value) => ({
  value,
  label: adminStatusLabel(value),
}))
const limitOptions: UiSelectOption[] = ADMIN_LIMITS.map((value) => ({
  value: String(value),
  label: String(value),
}))

function update(patch: Partial<Record<keyof JobFilters, string | undefined>>): void {
  void router.replace({ query: filtersToQuery({ ...filters.value, ...patch }) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard>
      <form class="grid gap-4 sm:grid-cols-4" aria-label="Фильтры заданий" @submit.prevent>
        <UiField v-slot="{ id, describedBy, invalid }" label="Организация (UUID)">
          <UiInput
            :id="id"
            :model-value="filters.tenantId ?? ''"
            name="tenantId"
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
            name="status"
            placeholder="Любой"
            :options="statusOptions"
            :described-by="describedBy"
            :invalid="invalid"
            @update:model-value="(value) => update({ status: value || undefined })"
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Тип">
          <UiInput
            :id="id"
            :model-value="filters.type ?? ''"
            name="type"
            :described-by="describedBy"
            :invalid="invalid"
            @change="
              (event: Event) =>
                update({ type: (event.target as HTMLInputElement).value.trim() || undefined })
            "
          />
        </UiField>
        <UiField v-slot="{ id, describedBy, invalid }" label="Лимит">
          <UiSelect
            :id="id"
            :model-value="String(filters.limit)"
            name="limit"
            :options="limitOptions"
            :described-by="describedBy"
            :invalid="invalid"
            @update:model-value="(value) => update({ limit: value })"
          />
        </UiField>
      </form>
    </UiCard>
    <SnapshotBar
      :updated-at="jobs.dataUpdatedAt.value"
      :loading="jobs.isFetching.value"
      @refresh="jobs.refetch()"
    />
    <UiCard>
      <div v-if="jobs.isPending.value" role="status" aria-label="Загрузка заданий">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="jobs.isError.value"
        :error="jobs.error.value"
        title="Не удалось загрузить задания"
        @retry="jobs.refetch()"
      />
      <UiEmptyState v-else-if="jobs.data.value?.length === 0" title="Заданий по фильтру нет" />
      <div
        v-else-if="jobs.data.value"
        class="relative overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Таблица заданий"
      >
        <p class="mb-2 text-xs text-muted">
          Показаны первые {{ jobs.data.value.length }} (лимит {{ filters.limit }}), новые первыми.
        </p>
        <table class="w-full min-w-[960px] text-left text-sm">
          <caption class="sr-only">
            Задания
          </caption>
          <thead>
            <tr class="text-xs font-semibold tracking-wide text-muted">
              <th scope="col" class="pb-2">Задание</th>
              <th scope="col" class="pb-2">Организация</th>
              <th scope="col" class="pb-2">Тип</th>
              <th scope="col" class="pb-2">Статус</th>
              <th scope="col" class="pb-2 text-right">Попытки</th>
              <th scope="col" class="pb-2">Ошибка</th>
              <th scope="col" class="pb-2">Доступно с</th>
              <th scope="col" class="pb-2">Метаданные</th>
              <th scope="col" class="pb-2"><span class="sr-only">Команды</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="job in jobs.data.value" :key="job.id">
              <td class="py-2 pr-4"><IdCell :value="job.id" /></td>
              <td class="py-2 pr-4"><IdCell :value="job.tenantId" /></td>
              <td class="py-2 pr-4 text-ink">{{ job.type }}</td>
              <td class="py-2 pr-4">
                <UiBadge :tone="adminStatusTone(job.status)">{{
                  adminStatusLabel(job.status)
                }}</UiBadge
                ><span v-if="job.discardedAt" class="ml-2 text-xs text-muted">отложено</span>
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">
                {{ job.attemptCount }}/{{ job.maxAttempts }}
              </td>
              <td class="py-2 pr-4">
                <code class="text-xs">{{ job.lastErrorCode ?? '—' }}</code>
              </td>
              <td class="py-2 pr-4 text-muted">{{ formatDateTime(job.availableAt, 'UTC') }}</td>
              <td class="py-2 pr-4">
                <code class="text-xs break-all text-muted">{{ safeJson(job.payload, 80) }}</code>
              </td>
              <td class="py-2">
                <RecoveryActions
                  :target="{
                    kind: 'job',
                    id: job.id,
                    tenantId: job.tenantId,
                    status: job.status,
                    discardedAt: job.discardedAt,
                  }"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>
