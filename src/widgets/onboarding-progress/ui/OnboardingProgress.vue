<script setup lang="ts">
/**
 * Шаги начала работы горизонтальным рядом (Figma «Начало работы»): выполненные — галочка, текущий —
 * синий кружок и подпись, дальше серые. Выполненность берётся из серверного статуса, текущий шаг —
 * из маршрута. Показаны четыре обязательных шага; необязательная привязка уведомлений в ряд не входит.
 * На телефоне подписи свёрнуты в строку «Шаг n из 4 · название».
 */
import { UiIcon } from '@/shared/ui'
import { computed } from 'vue'
import {
  ONBOARDING_STEP_ORDER,
  isOnboardingStepDone,
  onboardingStepLabel,
  type OnboardingStatus,
  type OnboardingStepKey,
} from '@/entities/organization'

const props = defineProps<{ status: OnboardingStatus | null; current: OnboardingStepKey | null }>()

const steps = computed(() =>
  ONBOARDING_STEP_ORDER.filter((key) => key !== 'TELEGRAM_LINK').map((key, index) => ({
    key,
    number: index + 1,
    label: onboardingStepLabel(key),
    done: key === 'ORGANIZATION' ? props.status !== null : isOnboardingStepDone(props.status, key),
    current: key === props.current,
  })),
)
const currentStep = computed(() => steps.value.find((step) => step.current) ?? null)
</script>

<template>
  <nav aria-label="Шаги начала работы" class="flex flex-col items-center gap-2 md:gap-3">
    <p v-if="currentStep" class="text-meta leading-[18px] text-secondary">
      Шаг {{ currentStep.number }} из {{ steps.length }}
      <span class="md:hidden">· {{ currentStep.label }}</span>
    </p>
    <div class="relative w-full">
      <div class="absolute top-[15px] right-[12.5%] left-[12.5%] h-px bg-line" aria-hidden="true" />
      <ol class="grid grid-cols-4">
        <!-- Линия между центрами крайних кружков; кружки лежат поверх неё. -->
        <li
          v-for="step in steps"
          :key="step.key"
          class="flex flex-col items-center gap-2.5"
          :aria-current="step.current ? 'step' : undefined"
        >
          <span
            :class="[
              'relative z-10 flex size-[30px] items-center justify-center rounded-full text-meta leading-[18px]',
              step.done || step.current ? 'bg-brand text-white' : 'bg-segment text-secondary',
            ]"
            aria-hidden="true"
          >
            <UiIcon v-if="step.done" name="check" class="size-5" />
            <template v-else>{{ step.number }}</template>
          </span>
          <span
            :class="[
              'hidden text-meta leading-[18px] md:block',
              step.current ? 'font-semibold text-link' : 'text-secondary',
            ]"
            aria-hidden="true"
          >
            {{ step.label }}
          </span>
          <!-- Название и состояние шага читаются на любой ширине, в том числе когда видимая подпись скрыта. -->
          <span class="sr-only"
            >{{ step.label }}
            {{ step.done ? 'выполнено' : step.current ? 'текущий шаг' : '' }}</span
          >
        </li>
      </ol>
    </div>
  </nav>
</template>
