<script setup lang="ts">
/**
 * Мёртвые письма четырёх очередей с одиночными командами восстановления.
 * Списки ограничены лимитом; после команды всё перечитывается.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDateTime } from '@/shared/lib'
import {
  UiBadge,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiField,
  UiSelect,
  UiSkeleton,
  type UiSelectOption,
} from '@/shared/ui'
import {
  ADMIN_LIMITS,
  adminStatusLabel,
  adminStatusTone,
  deadLetterKindLabel,
  deliveryChannelLabel,
  useDeadLettersQuery,
  type DeadLetterKind,
} from '@/entities/admin'
import { RecoveryActions } from '@/features/admin/recover-dead-letter'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'
import { filtersToQuery, parseLimit } from '../model/filters-query'

const route = useRoute()
const router = useRouter()
const limit = computed(() => parseLimit(route.query))
const dead = useDeadLettersQuery(limit)
const tab = ref<DeadLetterKind>('job')
const tabs: { kind: DeadLetterKind; label: string }[] = (
  ['job', 'outbox', 'aiJob', 'delivery'] as const
).map((kind) => ({ kind, label: deadLetterKindLabel(kind) }))
const limitOptions: UiSelectOption[] = ADMIN_LIMITS.map((value) => ({
  value: String(value),
  label: String(value),
}))

const counts = computed(() => ({
  job: dead.data.value?.jobs.length ?? 0,
  outbox: dead.data.value?.outbox.length ?? 0,
  aiJob: dead.data.value?.aiJobs.length ?? 0,
  delivery: dead.data.value?.deliveries.length ?? 0,
}))

function setLimit(value: string | undefined): void {
  void router.replace({ query: filtersToQuery({ limit: Number(value) }) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div role="tablist" aria-label="Очереди" class="flex flex-wrap gap-2">
        <button
          v-for="item in tabs"
          :key="item.kind"
          type="button"
          role="tab"
          :aria-selected="tab === item.kind"
          :class="[
            'rounded-control border px-3 py-2 text-sm font-semibold',
            tab === item.kind
              ? 'border-brand bg-brand-pale text-brand-dark'
              : 'border-line bg-paper text-ink hover:bg-canvas',
          ]"
          @click="tab = item.kind"
        >
          {{ item.label }} · {{ counts[item.kind] }}
        </button>
      </div>
      <UiField v-slot="{ id, describedBy, invalid }" label="Лимит" class="w-28">
        <UiSelect
          :id="id"
          :model-value="String(limit)"
          name="limit"
          :options="limitOptions"
          :described-by="describedBy"
          :invalid="invalid"
          @update:model-value="setLimit"
        />
      </UiField>
    </div>
    <SnapshotBar
      :updated-at="dead.dataUpdatedAt.value"
      :loading="dead.isFetching.value"
      @refresh="dead.refetch()"
    />
    <UiCard>
      <div v-if="dead.isPending.value" role="status" aria-label="Загрузка мёртвых писем">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="dead.isError.value"
        :error="dead.error.value"
        title="Не удалось загрузить мёртвые письма"
        @retry="dead.refetch()"
      />
      <template v-else-if="dead.data.value">
        <div v-if="tab === 'job'" role="tabpanel" aria-label="Задания">
          <UiEmptyState v-if="dead.data.value.jobs.length === 0" title="Мёртвых заданий нет" />
          <ul v-else class="divide-y divide-line" aria-label="Мёртвые задания">
            <li
              v-for="job in dead.data.value.jobs"
              :key="job.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div class="min-w-0 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-ink">{{ job.type }}</span
                  ><UiBadge :tone="adminStatusTone(job.status)">{{
                    adminStatusLabel(job.status)
                  }}</UiBadge>
                </div>
                <p class="mt-1 text-xs text-muted">
                  Задание <IdCell :value="job.id" /> · организация
                  <IdCell :value="job.tenantId" /> · попыток {{ job.attemptCount }}/{{
                    job.maxAttempts
                  }}
                  · ошибка <code>{{ job.lastErrorCode ?? '—' }}</code> · обновлено
                  {{ formatDateTime(job.updatedAt, 'UTC') }}
                </p>
              </div>
              <RecoveryActions
                :target="{
                  kind: 'job',
                  id: job.id,
                  tenantId: job.tenantId,
                  status: job.status,
                  discardedAt: job.discardedAt,
                }"
              />
            </li>
          </ul>
        </div>
        <div v-else-if="tab === 'outbox'" role="tabpanel" aria-label="События outbox">
          <UiEmptyState v-if="dead.data.value.outbox.length === 0" title="Мёртвых событий нет" />
          <ul v-else class="divide-y divide-line" aria-label="Мёртвые события">
            <li
              v-for="event in dead.data.value.outbox"
              :key="event.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div class="min-w-0 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-ink">{{ event.eventType }}</span
                  ><UiBadge :tone="adminStatusTone(event.status)">{{
                    adminStatusLabel(event.status)
                  }}</UiBadge>
                </div>
                <p class="mt-1 text-xs text-muted">
                  Событие <IdCell :value="event.id" /> · {{ event.aggregateType }}
                  <IdCell :value="event.aggregateId" /> · организация
                  <IdCell :value="event.tenantId" /> · попыток {{ event.attemptCount }}/{{
                    event.maxAttempts
                  }}
                  · ошибка <code>{{ event.lastErrorCode ?? '—' }}</code>
                </p>
              </div>
              <RecoveryActions
                :target="{
                  kind: 'outbox',
                  id: event.id,
                  tenantId: event.tenantId,
                  status: event.status,
                  discardedAt: event.discardedAt,
                }"
              />
            </li>
          </ul>
        </div>
        <div v-else-if="tab === 'aiJob'" role="tabpanel" aria-label="AI-задания">
          <UiEmptyState v-if="dead.data.value.aiJobs.length === 0" title="Мёртвых AI-заданий нет" />
          <ul v-else class="divide-y divide-line" aria-label="Мёртвые AI-задания">
            <li
              v-for="job in dead.data.value.aiJobs"
              :key="job.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div class="min-w-0 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-ink">{{ job.modelRequirement }}</span
                  ><UiBadge :tone="adminStatusTone(job.status)">{{
                    adminStatusLabel(job.status)
                  }}</UiBadge>
                </div>
                <p class="mt-1 text-xs text-muted">
                  AI-задание <IdCell :value="job.id" /> · переписка
                  <IdCell :value="job.conversationId" /> · организация
                  <IdCell :value="job.tenantId" /> · попыток {{ job.attempts }}/{{
                    job.maxAttempts
                  }}
                  · ошибка <code>{{ job.lastErrorCode ?? '—' }}</code>
                </p>
              </div>
              <RecoveryActions
                :target="{
                  kind: 'aiJob',
                  id: job.id,
                  tenantId: job.tenantId,
                  status: job.status,
                  discardedAt: job.discardedAt,
                }"
              />
            </li>
          </ul>
        </div>
        <div v-else role="tabpanel" aria-label="Доставки уведомлений">
          <UiEmptyState
            v-if="dead.data.value.deliveries.length === 0"
            title="Мёртвых доставок нет"
          />
          <ul v-else class="divide-y divide-line" aria-label="Мёртвые доставки">
            <li
              v-for="delivery in dead.data.value.deliveries"
              :key="delivery.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div class="min-w-0 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold text-ink"
                    >{{ delivery.kind }} · {{ deliveryChannelLabel(delivery.channel) }}</span
                  ><UiBadge :tone="adminStatusTone(delivery.status)">{{
                    adminStatusLabel(delivery.status)
                  }}</UiBadge>
                </div>
                <p class="mt-1 text-xs text-muted">
                  Доставка <IdCell :value="delivery.id" /> · уведомление
                  <IdCell :value="delivery.notificationId" /> · организация
                  <IdCell :value="delivery.tenantId" /> · попытка {{ delivery.attempt }} · код
                  <code>{{ delivery.failureCode ?? '—' }}</code>
                </p>
              </div>
              <RecoveryActions
                :target="{
                  kind: 'delivery',
                  id: delivery.id,
                  tenantId: delivery.tenantId,
                  status: delivery.status,
                  discardedAt: delivery.discardedAt,
                }"
              />
            </li>
          </ul>
        </div>
      </template>
    </UiCard>
  </div>
</template>
