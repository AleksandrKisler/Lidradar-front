<script setup lang="ts">
/**
 * Панель «Проверка»: что ожидаем, порядок «собрать → отправить → сверить» и результат сверки. Пока обработка
 * идёт — шкала этапов; потом — «Ожидали / Нашли» и ссылки в Radar и «Диалоги».
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { UiAlert, UiCard } from '@/shared/ui'
import { riskStatusLabel, riskTypeLabel } from '@/entities/risk'
import { verdictText, type SandboxDirection, type SandboxVerdict } from '@/entities/sandbox'
import { closedByText, stageProgress, stepStates } from '../model/view'

const props = defineProps<{
  expectedRiskType: string | null
  closedBy: SandboxDirection | null
  verdict: SandboxVerdict | null
  templateVersion: number | null
  sandboxId: string | null
  templateModified: boolean | null
  timeZone: string
  now: Date
}>()

const steps = computed(() => {
  const [build, send, check] = stepStates(props.verdict)
  return [
    {
      title: 'Соберите переписку',
      text: 'Кто что написал и сколько прошло времени. Пока это черновик.',
      state: build,
    },
    {
      title: 'Отправьте в систему',
      text: 'Обычно до минуты: сообщения проходят тот же путь, что из Telegram.',
      state: send,
    },
    {
      title: 'Сверьте результат',
      text: 'Песочница сравнит найденный риск с ожидаемым.',
      state: check,
    },
  ]
})
const result = computed(() =>
  props.verdict ? verdictText(props.verdict, props.timeZone, props.now) : null,
)
const progress = computed(() =>
  props.verdict?.state === 'PROCESSING' ? stageProgress(props.verdict) : null,
)
const tone = computed(() => {
  switch (props.verdict?.state) {
    case 'MATCH':
    case 'CLOSED':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'MISMATCH':
    case 'FAILED':
      return 'danger'
    default:
      return 'info'
  }
})
const foundText = computed(() => {
  const found = props.verdict?.found ?? []
  if (props.verdict?.state === 'PENDING') return 'Пока ничего'
  if (!found.length) return 'Рисков нет'
  return found
    .map((risk) => `${riskTypeLabel(risk.type)} (${riskStatusLabel(risk.status).toLowerCase()})`)
    .join(', ')
})
const reportLine = computed(() => {
  if (!props.verdict || !['MISMATCH', 'FAILED'].includes(props.verdict.state)) return null
  const parts = [`шаблоны v${props.templateVersion ?? '—'}`]
  if (props.verdict.analysisVersion) parts.push(`AI ${props.verdict.analysisVersion}`)
  if (props.sandboxId) parts.push(`песочница ${props.sandboxId}`)
  if (props.verdict.conversationId) parts.push(`диалог ${props.verdict.conversationId}`)
  if (props.verdict.failureMessageId) parts.push(`сообщение ${props.verdict.failureMessageId}`)
  return parts.join(' · ')
})
</script>

<template>
  <UiCard as="section" :padded="false" aria-labelledby="sandbox-check-title" class="flex flex-col">
    <h2 id="sandbox-check-title" class="px-6 pt-5 pb-2 text-base font-semibold text-ink">
      Проверка
    </h2>
    <section class="flex flex-col gap-2 border-b border-line px-6 py-4" aria-label="Ожидаемый риск">
      <p class="text-xs font-medium text-muted">Ожидаемый риск</p>
      <p class="text-base font-semibold text-ink">
        {{ expectedRiskType ? riskTypeLabel(expectedRiskType) : 'Не задан' }}
      </p>
      <p class="text-sm text-muted">{{ closedByText(closedBy) }}</p>
      <p v-if="templateModified" class="text-sm font-medium text-warning">Шаблон изменён</p>
    </section>

    <section
      v-if="verdict && result"
      class="flex flex-col gap-3 border-b border-line px-6 py-4"
      aria-live="polite"
    >
      <p class="text-xs font-medium text-muted">{{ progress ? 'Обработка' : 'Результат' }}</p>
      <template v-if="progress">
        <div
          class="h-1 overflow-hidden rounded-full bg-brand-pale"
          role="progressbar"
          :aria-valuenow="progress.percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="result.title"
        >
          <span
            class="block h-full rounded-full bg-brand transition-[width]"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>
        <ol class="flex flex-col gap-2">
          <li
            v-for="item in progress.items"
            :key="item.stage"
            :class="[
              'text-sm',
              item.state === 'done'
                ? 'text-success'
                : item.state === 'now'
                  ? 'font-semibold text-ink'
                  : 'text-muted',
            ]"
          >
            {{ item.label
            }}{{ item.state === 'done' ? ' — готово' : item.state === 'now' ? '…' : '' }}
          </li>
        </ol>
        <p class="text-sm text-muted">{{ result.description }}</p>
      </template>
      <template v-else>
        <UiAlert :tone="tone" :title="result.title">{{ result.description }}</UiAlert>
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Ожидали</dt>
          <dd class="text-ink">{{ expectedRiskType ? riskTypeLabel(expectedRiskType) : '—' }}</dd>
          <dt class="text-muted">Нашли</dt>
          <dd class="break-words text-ink">{{ foundText }}</dd>
        </dl>
        <p v-if="reportLine" class="text-xs break-all text-muted">Для отчёта: {{ reportLine }}</p>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            v-if="verdict.expectedRiskId"
            :to="{ name: 'risk', params: { riskId: verdict.expectedRiskId } }"
            class="inline-flex h-10 items-center rounded-control bg-brand-pale px-4 text-sm font-semibold text-brand-dark hover:bg-brand/15"
          >
            Открыть в Radar
          </RouterLink>
          <RouterLink
            v-if="verdict.conversationId"
            :to="{ name: 'conversation', params: { conversationId: verdict.conversationId } }"
            class="inline-flex h-10 items-center rounded-control border border-line bg-paper px-4 text-sm font-semibold text-ink hover:bg-canvas"
          >
            В «Диалогах»
          </RouterLink>
        </div>
      </template>
    </section>

    <section class="flex flex-col gap-1 px-6 py-4" aria-label="Порядок">
      <p class="text-xs font-medium text-muted">Порядок</p>
      <ol class="flex flex-col">
        <li
          v-for="(step, index) in steps"
          :key="step.title"
          class="grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-2"
        >
          <span
            :class="[
              'flex size-6 items-center justify-center rounded-full border text-xs font-semibold',
              step.state === 'now'
                ? 'border-brand bg-brand text-white'
                : step.state === 'done'
                  ? 'border-transparent bg-success-pale text-success'
                  : 'border-line text-muted',
            ]"
            :aria-label="
              step.state === 'done' ? 'выполнено' : step.state === 'now' ? 'сейчас' : undefined
            "
            >{{ index + 1 }}</span
          >
          <span class="flex min-w-0 flex-col gap-0.5">
            <span
              :class="['text-sm font-semibold', step.state === 'todo' ? 'text-muted' : 'text-ink']"
              >{{ step.title }}</span
            >
            <span class="text-xs text-muted">{{ step.text }}</span>
          </span>
        </li>
      </ol>
    </section>
  </UiCard>
</template>
