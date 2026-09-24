<script setup lang="ts">
/**
 * Рабочее пространство риска: причина, контекст переписки и сделки,
 * рекомендация, история и команды на одном маршруте.
 *
 * Команды показываются по последнему снимку и правам роли, но окончательное
 * решение принимает сервер: после каждой команды карточка перечитывается и
 * кнопки пересчитываются. Ошибка одной команды не скрывает контекст.
 */
import { computed, onScopeDispose, ref, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { formatDateTime, formatRelative } from '@/shared/lib'
import { UiAlert, UiBadge, UiButton, UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import {
  RiskSeverityBadge,
  externalLinkUnavailableLabel,
  opportunityStageLabel,
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
import RiskHistory from './RiskHistory.vue'
import OpportunityTimeline from './OpportunityTimeline.vue'

const props = defineProps<{ tenantId: string; riskId: string }>()

const session = useSessionStore()
const organization = useOrganizationQuery(toRef(props, 'tenantId'))
const query = useRiskDetailQuery(toRef(props, 'tenantId'), toRef(props, 'riskId'))

const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')
const vm = computed(() => (query.data.value ? toRiskWorkspace(query.data.value) : null))

const canManage = computed(() => session.can('risks.manage'))
const canAct = computed(() => session.can('action.manage'))
const canRecordOutcome = computed(() => session.can('outcome.manage'))
const canConfirmRevenue = computed(() => session.can('revenue.confirm'))
const canReadConversation = computed(() => session.can('conversation.read'))
const canManageOpportunity = computed(() => session.can('opportunity.manage'))

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

/** Опорное «сейчас» для относительного времени; обновляется раз в минуту. */
const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))

function absolute(value: string | null): string | null {
  return value ? formatDateTime(value, timeZone.value) : null
}
function relative(value: string | null): string | null {
  return value ? formatRelative(value, now.value) : null
}

const messageAuthor = computed(() => {
  switch (vm.value?.lastMessage?.direction) {
    case 'INCOMING':
      return 'Клиент'
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
  <div
    v-if="query.isPending.value"
    role="status"
    aria-label="Загрузка риска"
    class="flex flex-col gap-6"
  >
    <UiSkeleton class="h-5 w-48" />
    <UiSkeleton class="h-9 w-72" />
    <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]">
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

    <header class="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <RiskSeverityBadge :severity="vm.severity" />
          <span class="text-sm font-semibold text-ink">{{ vm.typeLabel }}</span>
          <UiBadge :tone="vm.statusTone">{{ vm.statusLabel }}</UiBadge>
        </div>
        <h1 id="risk-title" class="mt-2 text-2xl font-bold break-words text-ink md:text-3xl">
          {{ vm.contactName }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          <template v-if="vm.serviceName">{{ vm.serviceName }}</template>
          <template v-if="vm.serviceName && vm.channelName"> · </template>
          <template v-if="vm.channelName">{{ vm.channelName }}</template>
          <template v-if="!vm.serviceName && !vm.channelName">Услуга не определена</template>
        </p>
      </div>
      <div class="flex items-start gap-4">
        <div class="text-right">
          <p class="text-xs font-semibold tracking-wide text-muted uppercase">
            Потенциальная выручка
          </p>
          <p class="text-2xl font-bold text-ink tabular-nums">
            {{ vm.money?.potential ?? 'Сумма не указана' }}
          </p>
        </div>
        <UiButton
          variant="secondary"
          size="sm"
          :loading="query.isFetching.value"
          @click="query.refetch()"
        >
          Обновить
        </UiButton>
      </div>
    </header>

    <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px] md:items-start">
      <div class="flex min-w-0 flex-col gap-6">
        <UiCard as="section" aria-labelledby="risk-reason-title">
          <h2 id="risk-reason-title" class="text-lg font-bold text-ink">Почему это риск</h2>
          <p class="mt-2 text-base leading-7 text-ink">{{ vm.reason }}</p>
          <dl class="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Обнаружен</dt>
              <dd class="text-ink">
                <time :datetime="vm.detectedAt" :title="absolute(vm.detectedAt) ?? undefined">
                  {{ relative(vm.detectedAt) }}
                </time>
              </dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Ожидание с</dt>
              <dd class="text-ink">
                <time :datetime="vm.dueAt" :title="absolute(vm.dueAt) ?? undefined">
                  {{ relative(vm.dueAt) }}
                </time>
              </dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Источник</dt>
              <dd class="text-ink">{{ vm.sourceLabel }}</dd>
            </div>
            <div v-if="vm.confidence !== null" class="flex gap-1">
              <dt class="text-muted">Уверенность AI</dt>
              <dd class="text-ink">{{ Math.round(vm.confidence * 100) }} %</dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Код причины</dt>
              <dd class="font-mono text-xs break-all text-ink">{{ vm.reasonCode }}</dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Версия правил</dt>
              <dd class="font-mono text-xs break-all text-ink">{{ vm.policyVersion }}</dd>
            </div>
          </dl>
        </UiCard>

        <UiCard as="section" aria-labelledby="risk-context-title">
          <h2 id="risk-context-title" class="text-lg font-bold text-ink">Переписка и сделка</h2>
          <dl class="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Услуга</dt>
              <dd class="text-ink">
                {{ vm.serviceName ?? 'не определена' }}
                <span v-if="vm.serviceActive === false" class="text-muted">(неактивна)</span>
              </dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Канал</dt>
              <dd class="text-ink">{{ vm.channelName ?? 'не определён' }}</dd>
            </div>
            <div class="flex min-w-0 flex-wrap gap-x-1">
              <dt class="text-muted">Этап сделки</dt>
              <dd class="text-ink" data-testid="opportunity-stage">
                {{ currentStage ? opportunityStageLabel(currentStage) : 'сделка не создана' }}
              </dd>
            </div>
          </dl>

          <blockquote
            v-if="vm.lastMessage"
            class="mt-4 rounded-control border-l-4 border-line bg-canvas px-4 py-3 text-sm text-ink"
          >
            <p>
              <span class="font-semibold text-muted">{{ messageAuthor }}: </span>
              <template v-if="vm.lastMessage.preview">{{ vm.lastMessage.preview }}</template>
              <span v-else class="text-muted">сообщение без текста</span>
            </p>
            <footer class="mt-1 text-xs text-muted">
              <time :datetime="vm.lastMessage.sentAt">{{ absolute(vm.lastMessage.sentAt) }}</time>
            </footer>
          </blockquote>
          <p v-else class="mt-4 text-sm text-muted">Последнее сообщение недоступно.</p>

          <div class="mt-4 flex flex-wrap items-center gap-4">
            <RouterLink
              v-if="vm.conversationId && canReadConversation"
              :to="{ name: 'conversation', params: { conversationId: vm.conversationId } }"
              class="text-sm font-semibold text-brand-dark hover:underline"
            >
              Открыть переписку
            </RouterLink>
            <OpenConversationButton
              v-if="vm.externalUrl"
              :url="vm.externalUrl"
              :risk-id="vm.id"
              :can-record="canAct && vm.isActive"
            />
            <p v-else-if="unavailableText" class="text-sm text-muted">{{ unavailableText }}</p>
          </div>

          <section
            v-if="vm.opportunityId && canManageOpportunity"
            aria-labelledby="stages-title"
            class="mt-5 border-t border-line pt-4"
          >
            <h3 id="stages-title" class="text-sm font-semibold text-ink">Этапы сделки</h3>
            <div
              v-if="opportunity.isPending.value"
              class="mt-2"
              role="status"
              aria-label="Загрузка этапов"
            >
              <UiSkeleton class="h-10 w-full" />
            </div>
            <UiErrorState
              v-else-if="opportunity.isError.value"
              class="mt-2"
              :error="opportunity.error.value"
              title="Не удалось загрузить историю этапов"
              @retry="opportunity.refetch()"
            />
            <template v-else-if="opportunity.data.value">
              <div class="mt-3">
                <StageChangeControl
                  :risk-id="vm.id"
                  :opportunity-id="vm.opportunityId"
                  :current-stage="opportunity.data.value.opportunity.stage"
                />
              </div>
              <div class="mt-4">
                <OpportunityTimeline
                  :entries="opportunity.data.value.stageHistory"
                  :time-zone="timeZone"
                />
              </div>
            </template>
          </section>
        </UiCard>

        <UiCard as="section" aria-labelledby="risk-recommendation-title">
          <h2 id="risk-recommendation-title" class="text-lg font-bold text-ink">Рекомендация</h2>
          <p v-if="vm.recommendation" class="mt-2 text-base leading-7 text-ink">
            {{ vm.recommendation }}
          </p>
          <div v-else class="mt-2 flex flex-col gap-3">
            <p class="text-sm text-muted">Рекомендации по этому риску пока нет.</p>
            <EnsureRecommendationButton v-if="canManage && vm.isActive" :risk-id="vm.id" />
          </div>
        </UiCard>

        <UiCard as="section" aria-labelledby="risk-history-title">
          <h2 id="risk-history-title" class="text-lg font-bold text-ink">История</h2>
          <div class="mt-2">
            <RiskHistory :entries="vm.history" :time-zone="timeZone" />
          </div>
        </UiCard>
      </div>

      <aside class="flex flex-col gap-6" aria-label="Действия по риску">
        <UiCard as="section" aria-labelledby="risk-status-title">
          <h2 id="risk-status-title" class="text-lg font-bold text-ink">Статус</h2>
          <dl class="mt-3 flex flex-col gap-1.5 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Сейчас</dt>
              <dd class="font-semibold text-ink">{{ vm.statusLabel }}</dd>
            </div>
            <div v-if="vm.acknowledgedAt" class="flex justify-between gap-3">
              <dt class="text-muted">В работе с</dt>
              <dd class="text-ink">{{ absolute(vm.acknowledgedAt) }}</dd>
            </div>
            <div v-if="vm.actedAt" class="flex justify-between gap-3">
              <dt class="text-muted">Действие</dt>
              <dd class="text-ink">{{ absolute(vm.actedAt) }}</dd>
            </div>
            <div v-if="vm.resolvedAt" class="flex justify-between gap-3">
              <dt class="text-muted">Закрыт</dt>
              <dd class="text-ink">{{ absolute(vm.resolvedAt) }}</dd>
            </div>
          </dl>

          <div v-if="vm.isActive && canManage" class="mt-4 flex flex-col gap-3">
            <AcknowledgeRiskButton v-if="vm.status === 'OPEN'" :risk-id="vm.id" />
            <ResolveRiskButton :risk-id="vm.id" />
          </div>
          <p v-else-if="!vm.isActive" class="mt-4 text-sm text-muted">
            Риск закрыт: история доступна только для чтения.
          </p>
        </UiCard>

        <UiCard v-if="canManage" as="section" aria-labelledby="risk-feedback-title">
          <h2 id="risk-feedback-title" class="text-lg font-bold text-ink">Оценка сигнала</h2>
          <p class="mt-1 mb-4 text-sm text-muted">
            Верно ли Radar понял ситуацию: оценки помогают настраивать правила.
          </p>
          <RiskFeedbackPanel :risk-id="vm.id" :is-active="vm.isActive" />
        </UiCard>

        <UiCard v-if="vm.isActive && canAct" as="section" aria-labelledby="risk-action-title">
          <h2 id="risk-action-title" class="text-lg font-bold text-ink">Записать действие</h2>
          <p class="mt-1 mb-4 text-sm text-muted">
            Только после того, как действие действительно выполнено.
          </p>
          <RecordActionForm :risk-id="vm.id" />
        </UiCard>

        <UiCard
          v-if="vm.isActive && canRecordOutcome && vm.opportunityId"
          as="section"
          aria-labelledby="risk-outcome-title"
        >
          <h2 id="risk-outcome-title" class="text-lg font-bold text-ink">Записать исход</h2>
          <p class="mt-1 mb-4 text-sm text-muted">Чем ответил клиент после вашего действия.</p>
          <RecordOutcomeForm :risk-id="vm.id" :opportunity-id="vm.opportunityId" />
        </UiCard>

        <UiCard as="section" aria-labelledby="risk-money-title">
          <h2 id="risk-money-title" class="text-lg font-bold text-ink">Деньги</h2>
          <dl class="mt-3 flex flex-col gap-1.5 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Потенциальная</dt>
              <dd class="font-semibold text-ink tabular-nums">
                {{ vm.money?.potential ?? 'не указана' }}
              </dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-muted">Подтверждённо возвращённая</dt>
              <dd class="font-semibold text-ink tabular-nums">
                {{ vm.money?.confirmedRecovered ?? 'подтверждений нет' }}
              </dd>
            </div>
          </dl>
          <p class="mt-3 text-xs text-muted">
            Исход «Оплатил» не создаёт выручку: сумма подтверждается отдельно.
          </p>
          <div v-if="canConfirmRevenue && revenueEvidence" class="mt-4">
            <ConfirmRevenueButton :evidence="revenueEvidence" />
          </div>
        </UiCard>
      </aside>
    </div>
  </article>
</template>
