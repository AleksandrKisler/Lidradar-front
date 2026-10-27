<script setup lang="ts">
/**
 * Рабочее пространство риска: причина, контекст переписки и сделки,
 * рекомендация, история и команды на одном маршруте.
 *
 * Команды показываются по последнему снимку и правам роли, но окончательное
 * решение принимает сервер: после каждой команды карточка перечитывается и
 * кнопки пересчитываются. Ошибка одной команды не скрывает контекст.
 */
import { computed, toRef } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { hasPendingCommand, useRealtimeState } from '@/shared/api'
import { formatDateTime, formatDayTime } from '@/shared/lib'
import {
  UiAlert,
  UiButton,
  UiCard,
  UiErrorState,
  UiGlyph,
  UiIcon,
  UiSkeleton,
  UiSpinner,
} from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import {
  RiskSeverityBadge,
  externalLinkUnavailableLabel,
  opportunityStageLabel,
  stageSourceLabel,
  toRiskWorkspace,
  useOpportunityDetailQuery,
  useRiskDetailQuery,
} from '@/entities/risk'
import {
  AcknowledgeRiskButton,
  EnsureRecommendationButton,
  ResolveRiskButton,
} from '@/features/risk-commands'
import { OpenConversationButton, RecordActionForm } from '@/features/record-action'
import { RecordOutcomeForm } from '@/features/record-outcome'
import { ConfirmRevenueButton, type RevenueEvidence } from '@/features/confirm-revenue'
import { RiskFeedbackPanel } from '@/features/risk-feedback'
import { StageChangeControl } from '@/features/change-opportunity-stage'
import RiskHistory, { type RiskTimelineEntry } from './RiskHistory.vue'

const props = defineProps<{
  tenantId: string
  riskId: string
  /** Куда ведёт «← Radar»; ссылка и «Обновить» стоят в одной строке над карточкой. */
  backTo?: RouteLocationRaw | undefined
}>()

const session = useSessionStore()
const organization = useOrganizationQuery(toRef(props, 'tenantId'))
const locations = useLocationsQuery(toRef(props, 'tenantId'))
const query = useRiskDetailQuery(toRef(props, 'tenantId'), toRef(props, 'riskId'))

const realtime = useRealtimeState()
/** Автообновление недоступно: красная точка у кнопки обновления (Figma 256:2511). */
const autoRefreshDown = computed(() => realtime.value === 'backoff' || realtime.value === 'offline')

const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const vm = computed(() => (query.data.value ? toRiskWorkspace(query.data.value) : null))
/** Имя точки — только по её идентификатору из списка точек; иначе не показывается. */
const locationName = computed(() => {
  const id = vm.value?.locationId
  return id ? (locations.data.value?.find((location) => location.id === id)?.name ?? null) : null
})

const canManage = computed(() => session.can('risks.manage'))
const canAct = computed(() => session.can('action.manage'))
const canRecordOutcome = computed(() => session.can('outcome.manage'))
const canConfirmRevenue = computed(() => session.can('revenue.confirm'))
const canReadConversation = computed(() => session.can('conversation.read'))
const canManageOpportunity = computed(() => session.can('opportunity.manage'))

function pendingCommand(operation: 'action' | 'outcome', resource: string) {
  return (
    !!session.user &&
    hasPendingCommand(JSON.stringify([session.user.id, props.tenantId, operation, resource]))
  )
}

// Сделка читается отдельно: полная история этапов есть только в её ответе.
const opportunity = useOpportunityDetailQuery(toRef(props, 'tenantId'), () =>
  canManageOpportunity.value ? (vm.value?.opportunityId ?? null) : null,
)
/** Текущий этап — из ответа сделки; до его загрузки — из снимка карточки. */
const currentStage = computed(
  () => opportunity.data.value?.opportunity.stage ?? query.data.value?.opportunity?.stage ?? null,
)

/** Цепочка для атрибуции «возвращённая выручка» из снимка карточки. */
const revenueEvidence = computed<RevenueEvidence | null>(() => {
  const current = vm.value
  if (!current?.opportunityId) return null
  return {
    riskId: current.id,
    opportunityId: current.opportunityId,
    currency: current.money?.currency ?? organization.data.value?.defaultCurrency ?? 'RUB',
    suggestedAmount: current.potentialAmount,
    actions: current.history.filter((entry) => entry.kind === 'action'),
    outcome: current.history.find((entry) => entry.kind === 'outcome') ?? null,
    timeZone: timeZone.value,
  }
})

/** События для истории: обнаружение, этапы сделки (если прочитаны), действия и исход. */
const timeline = computed<RiskTimelineEntry[]>(() => {
  const current = vm.value
  if (!current) return []
  const entries: RiskTimelineEntry[] = [
    {
      id: current.id,
      kind: 'detected',
      title: 'Риск обнаружен',
      detail: current.reason,
      createdAt: current.detectedAt,
    },
  ]
  for (const stage of opportunity.data.value?.stageHistory ?? []) {
    entries.push({
      id: stage.id,
      kind: 'stage',
      title: stage.fromStage
        ? `Этап: ${opportunityStageLabel(stage.fromStage)} → ${opportunityStageLabel(stage.toStage)}`
        : `Сделка создана · ${opportunityStageLabel(stage.toStage)}`,
      detail:
        stageSourceLabel(stage.source) +
        (stage.confidence !== null ? ` · уверенность ${Math.round(stage.confidence * 100)} %` : ''),
      createdAt: stage.createdAt,
    })
  }
  for (const entry of current.history) {
    entries.push({
      id: entry.id,
      kind: entry.kind,
      title: entry.label,
      detail: entry.kind === 'outcome' ? 'Исход клиента' : 'Выполненное действие',
      createdAt: entry.createdAt,
    })
  }
  return entries
})

/** Последний переход этапа одной строкой (Figma 212:2665). */
const stageNote = computed(() => {
  const latest = [...(opportunity.data.value?.stageHistory ?? [])].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0]
  if (!latest) return null
  const when = absolute(latest.createdAt)
  return latest.fromStage ? `Изменена ${when}` : `Создана ${when}`
})

function dayTime(value: string | null): string | null {
  return value ? formatDayTime(value, timeZone.value) : null
}
function absolute(value: string | null): string | null {
  return value ? formatDateTime(value, timeZone.value) : null
}

const messageAuthor = computed(() => {
  switch (vm.value?.lastMessage?.direction) {
    case 'INCOMING':
      return vm.value.contactName || 'Клиент'
    case 'OUTGOING':
      return 'Вы'
    default:
      return 'Система'
  }
})

const unavailableText = computed(() =>
  vm.value ? externalLinkUnavailableLabel(vm.value.externalUnavailableReason) : null,
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between gap-3">
      <RouterLink
        v-if="backTo"
        :to="backTo"
        class="inline-flex items-center gap-1 rounded-field border border-line bg-paper font-medium text-ink hover:bg-canvas max-md:h-[46px] max-md:gap-2 max-md:rounded-button max-md:px-4 max-md:text-field max-md:leading-5 md:h-9 md:px-2.5 md:text-[13px] md:leading-5"
      >
        <UiIcon name="arrow-back" class="size-4" />К рискам
      </RouterLink>
      <span v-else />
      <button
        type="button"
        class="relative flex size-[46px] shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink hover:bg-canvas disabled:opacity-60"
        :aria-busy="query.isFetching.value || undefined"
        :aria-disabled="query.isFetching.value || undefined"
        :title="autoRefreshDown ? 'Автообновление недоступно: обновляйте вручную' : undefined"
        @click="!query.isFetching.value && query.refetch()"
      >
        <UiSpinner v-if="query.isFetching.value" class="size-5" />
        <UiGlyph v-else name="refresh" class="size-5" />
        <span class="sr-only">Обновить</span>
        <span
          v-if="autoRefreshDown"
          class="absolute top-[1px] right-[1px] size-3 rounded-full border-2 border-paper bg-danger"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      v-if="query.isPending.value"
      role="status"
      aria-label="Загрузка риска"
      class="flex flex-col gap-6"
    >
      <UiSkeleton class="h-5 w-48" />
      <UiSkeleton class="h-9 w-72" />
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_392px]">
        <UiCard><UiSkeleton class="h-40 w-full" /></UiCard>
        <UiCard><UiSkeleton class="h-40 w-full" /></UiCard>
      </div>
    </div>

    <!-- Ошибка без снимка — экран ошибки; ошибка при обновлении оставляет снимок с пометкой. -->
    <UiErrorState
      v-else-if="!vm"
      :error="query.error.value"
      title="Не удалось загрузить риск"
      @retry="query.refetch()"
    />

    <article v-else aria-labelledby="risk-title" class="flex flex-col gap-6">
      <UiAlert v-if="query.isError.value" tone="warning" title="Не удалось обновить данные">
        Показан последний успешный снимок.
      </UiAlert>

      <!-- Ситуация (Figma «Ситуация · Тип, клиент и ожидание») -->
      <section
        class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6"
        aria-labelledby="risk-reason-title"
      >
        <div
          class="flex flex-col gap-4 md:flex-row-reverse md:items-start md:justify-between md:gap-6"
        >
          <div class="flex shrink-0 items-center gap-2">
            <RiskSeverityBadge :severity="vm.severity" />
            <span
              class="inline-flex h-7 items-center rounded-full bg-canvas px-4 text-meta font-medium whitespace-nowrap text-muted"
              >{{ vm.statusLabel }}</span
            >
          </div>
          <div class="flex min-w-0 flex-col gap-2">
            <h1
              id="risk-title"
              class="min-w-0 text-[28px] leading-[34px] font-semibold break-words text-ink md:text-[32px] md:leading-10"
            >
              {{ vm.typeLabel }}
            </h1>
            <p class="text-lg leading-[25px] text-muted">
              {{ vm.contactName }}<template v-if="vm.serviceName"> · {{ vm.serviceName }}</template
              ><template v-else> · Услуга не уточнена</template
              ><template v-if="locationName"> · {{ locationName }}</template>
            </p>
          </div>
        </div>
        <h2 id="risk-reason-title" class="sr-only">Почему это риск</h2>
        <p class="text-lg leading-[25px] text-ink">{{ vm.reason }}</p>
        <div class="h-px bg-line" aria-hidden="true" />
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 md:gap-x-6 lg:flex lg:flex-wrap lg:gap-x-8">
            <!-- dueAt — срок по правилу, а не начало ожидания: длительность не вычисляется. -->
            <div class="flex min-w-0 flex-col gap-1 lg:min-w-[200px]">
              <dt class="flex items-start gap-2 text-sm leading-5 text-muted">
                <UiGlyph name="clock" class="mt-0.5 size-4 shrink-0" />Срок по правилу
              </dt>
              <dd class="text-[17px] leading-6 font-medium text-ink md:text-lg">
                <time v-if="dayTime(vm.dueAt)" :datetime="vm.dueAt">{{ dayTime(vm.dueAt) }}</time>
                <span v-else class="text-muted">Не указан</span>
              </dd>
              <dd class="text-xs leading-[18px] text-muted">Часовой пояс: {{ timeZone }}</dd>
            </div>
            <div class="flex min-w-0 flex-col gap-1 lg:min-w-[200px]">
              <dt class="flex items-start gap-2 text-sm leading-5 text-muted">
                <UiGlyph name="clock" class="mt-0.5 size-4 shrink-0" />Риск обнаружен
              </dt>
              <dd class="text-[17px] leading-6 font-medium text-ink md:text-lg">
                <time v-if="dayTime(vm.detectedAt)" :datetime="vm.detectedAt">{{
                  dayTime(vm.detectedAt)
                }}</time>
                <span v-else class="text-muted">Не указан</span>
              </dd>
            </div>
            <div v-if="vm.acknowledgedAt" class="flex min-w-0 flex-col gap-1 lg:min-w-[200px]">
              <dt class="text-sm leading-5 text-muted">В работе с</dt>
              <dd class="text-lg leading-6 font-medium text-ink">
                {{ absolute(vm.acknowledgedAt) }}
              </dd>
            </div>
            <div v-if="vm.actedAt" class="flex min-w-0 flex-col gap-1 lg:min-w-[200px]">
              <dt class="text-sm leading-5 text-muted">Действие</dt>
              <dd class="text-lg leading-6 font-medium text-ink">{{ absolute(vm.actedAt) }}</dd>
            </div>
            <div v-if="vm.resolvedAt" class="flex min-w-0 flex-col gap-1 lg:min-w-[200px]">
              <dt class="text-sm leading-5 text-muted">Закрыт</dt>
              <dd class="text-lg leading-6 font-medium text-ink">{{ absolute(vm.resolvedAt) }}</dd>
            </div>
          </dl>
          <div v-if="vm.isActive && canManage && vm.status === 'OPEN'" class="lg:w-[228px]">
            <AcknowledgeRiskButton :risk-id="vm.id" />
          </div>
        </div>
        <p v-if="!vm.isActive" class="text-sm text-muted">
          Риск закрыт: история доступна только для чтения.
        </p>
      </section>

      <div
        class="grid grid-cols-[minmax(0,1fr)] gap-6 max-lg:contents lg:grid-cols-[minmax(0,1fr)_392px] lg:items-start"
      >
        <div class="flex min-w-0 flex-col gap-6 max-lg:contents">
          <section
            class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-1"
            aria-labelledby="risk-context-title"
          >
            <h2 id="risk-context-title" class="text-[17px] leading-6 font-semibold text-ink">
              Переписка
            </h2>
            <div
              class="flex flex-col gap-2 text-sm leading-5 text-muted md:flex-row md:items-center md:justify-between md:gap-4"
            >
              <p>
                {{ vm.channelName ?? 'Канал не определён'
                }}<template v-if="locationName"> · {{ locationName }}</template>
              </p>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                <RouterLink
                  v-if="vm.conversationId && canReadConversation"
                  :to="{ name: 'conversation', params: { conversationId: vm.conversationId } }"
                  class="text-sm font-medium text-link hover:underline"
                >
                  Открыть переписку
                </RouterLink>
                <p class="text-meta">Только чтение</p>
              </div>
            </div>
            <blockquote
              v-if="vm.lastMessage"
              class="flex flex-col gap-2 rounded-control bg-canvas p-4 text-ink"
            >
              <p class="text-sm leading-5 text-muted">
                {{ messageAuthor }} ·
                <time :datetime="vm.lastMessage.sentAt">{{ dayTime(vm.lastMessage.sentAt) }}</time>
              </p>
              <p class="text-base leading-6">
                <template v-if="vm.lastMessage.preview">{{ vm.lastMessage.preview }}</template>
                <span v-else class="text-muted">сообщение без текста</span>
              </p>
            </blockquote>
            <p v-else class="text-sm text-muted">Последнее сообщение недоступно.</p>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
              <OpenConversationButton
                v-if="vm.externalUrl"
                :url="vm.externalUrl"
                :risk-id="vm.id"
                :can-record="canAct && vm.isActive"
              />
              <template v-else>
                <UiButton
                  variant="secondary"
                  class="md:w-[252px]"
                  disabled
                  :aria-describedby="unavailableText ? 'telegram-unavailable' : undefined"
                >
                  Открыть в Telegram
                </UiButton>
                <p
                  v-if="unavailableText"
                  id="telegram-unavailable"
                  class="max-w-sm text-sm leading-5 text-muted"
                >
                  {{ unavailableText }}. Читайте переписку в LidRadar.
                </p>
              </template>
            </div>
          </section>

          <section
            v-if="
              (canAct && (vm.isActive || pendingCommand('action', vm.id))) ||
              (canRecordOutcome &&
                vm.opportunityId &&
                (vm.isActive || pendingCommand('outcome', vm.opportunityId)))
            "
            class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-3"
            aria-labelledby="risk-work-title"
          >
            <h2 id="risk-work-title" class="text-[17px] leading-6 font-semibold text-ink">
              Работа по риску
            </h2>
            <p class="text-sm leading-5 text-muted">
              Запишите выполненное действие, затем — реакцию клиента.
            </p>
            <div class="grid gap-6 md:grid-cols-2">
              <section
                v-if="canAct && (vm.isActive || pendingCommand('action', vm.id))"
                aria-labelledby="risk-action-title"
              >
                <h3 id="risk-action-title" class="sr-only">
                  {{ vm.isActive ? 'Записать действие' : 'Проверить незавершённое действие' }}
                </h3>
                <RecordActionForm :risk-id="vm.id" :disabled="!vm.isActive" />
              </section>
              <section
                v-if="
                  canRecordOutcome &&
                  vm.opportunityId &&
                  (vm.isActive || pendingCommand('outcome', vm.opportunityId))
                "
                aria-labelledby="risk-outcome-title"
              >
                <h3 id="risk-outcome-title" class="sr-only">Записать исход</h3>
                <RecordOutcomeForm
                  :risk-id="vm.id"
                  :opportunity-id="vm.opportunityId"
                  :disabled="!vm.isActive"
                />
              </section>
            </div>
          </section>

          <section
            class="rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-6"
            aria-labelledby="risk-history-title"
          >
            <RiskHistory :entries="timeline" :time-zone="timeZone" />
          </section>
        </div>

        <aside class="flex flex-col gap-6 max-lg:contents" aria-label="Действия по риску">
          <section
            class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-4"
            aria-labelledby="risk-money-title"
          >
            <h2
              id="risk-money-title"
              class="flex items-center gap-2 text-[17px] leading-6 font-semibold text-ink"
            >
              <UiGlyph name="banknote" class="size-[18px]" />Потенциал сделки
            </h2>
            <div class="flex flex-col gap-4">
              <p class="text-[28px] leading-[34px] font-semibold text-ink tabular-nums">
                {{ vm.money?.potential ?? 'Сумма не определена' }}
              </p>
              <p class="text-sm leading-5 text-muted">Оценка сделки под риском</p>
            </div>
            <div class="h-px bg-line" aria-hidden="true" />
            <dl class="flex flex-col gap-1">
              <dt class="text-sm leading-5 text-muted">Подтверждённо возвращено</dt>
              <dd class="text-base leading-6 font-medium text-ink tabular-nums">
                {{ vm.money?.confirmedRecovered ?? 'Нет подтверждений' }}
              </dd>
            </dl>
            <div v-if="canConfirmRevenue && revenueEvidence">
              <ConfirmRevenueButton :evidence="revenueEvidence" />
            </div>
            <p class="text-sm leading-5 text-muted">
              Исход «Оплатил» сам по себе не подтверждает оплату.
            </p>
          </section>

          <section
            class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-2"
            aria-labelledby="risk-recommendation-title"
          >
            <h2 id="risk-recommendation-title" class="text-[17px] leading-6 font-semibold text-ink">
              Рекомендация
            </h2>
            <p v-if="vm.recommendation" class="text-base leading-6 text-ink">
              {{ vm.recommendation }}
            </p>
            <template v-else>
              <p class="text-sm leading-5 text-muted">
                {{
                  canManage && vm.isActive
                    ? 'Получите следующий шаг на основе переписки и причины риска.'
                    : 'Рекомендации по этому риску пока нет.'
                }}
              </p>
              <EnsureRecommendationButton v-if="canManage && vm.isActive" :risk-id="vm.id" />
            </template>
          </section>

          <section
            v-if="vm.opportunityId && canManageOpportunity"
            class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-5"
            aria-labelledby="stages-title"
          >
            <h2 id="stages-title" class="text-[17px] leading-6 font-semibold text-ink">
              Этап сделки
            </h2>
            <div v-if="opportunity.isPending.value" role="status" aria-label="Загрузка этапов">
              <UiSkeleton class="h-10 w-full" />
            </div>
            <UiErrorState
              v-else-if="opportunity.isError.value"
              :error="opportunity.error.value"
              title="Не удалось загрузить историю этапов"
              @retry="opportunity.refetch()"
            />
            <template v-else-if="opportunity.data.value">
              <p class="flex items-baseline justify-between gap-3 text-sm leading-5">
                <span class="text-muted">Сейчас</span>
                <span class="text-base font-semibold text-ink" data-testid="opportunity-stage">{{
                  currentStage ? opportunityStageLabel(currentStage) : 'сделка не создана'
                }}</span>
              </p>
              <StageChangeControl
                :risk-id="vm.id"
                :opportunity-id="vm.opportunityId"
                :current-stage="opportunity.data.value.opportunity.stage"
              />
              <p v-if="stageNote" class="text-sm leading-5 text-muted">{{ stageNote }}</p>
            </template>
          </section>

          <div v-if="vm.isActive && canManage" class="max-lg:order-8">
            <ResolveRiskButton :risk-id="vm.id" />
          </div>
        </aside>
      </div>

      <section
        v-if="canManage"
        class="flex flex-col gap-4 rounded-card border border-line bg-paper p-5 md:p-6 max-lg:order-7"
        aria-labelledby="risk-feedback-title"
      >
        <h2 id="risk-feedback-title" class="text-[17px] leading-6 font-semibold text-ink">
          Оценка сигнала
        </h2>
        <p class="text-sm leading-5 text-muted">
          Верно ли Radar определил ситуацию? Оценка помогает уточнять правила.
        </p>
        <RiskFeedbackPanel :risk-id="vm.id" :is-active="vm.isActive" />
      </section>
    </article>
  </div>
</template>
