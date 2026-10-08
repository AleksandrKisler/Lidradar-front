<script setup lang="ts">
/**
 * Шаги начала работы с признаком выполнения из серверного статуса.
 * Текущий шаг определяется маршрутом, выполненность — данными организации.
 * Нумеруются только обязательные шаги, чтобы число кружков совпадало с
 * «Шаг n из 4» в заголовках страниц; необязательный шаг помечен колокольчиком.
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

const steps = computed(() => {
  let number = 0
  return ONBOARDING_STEP_ORDER.map((key) => {
    // До загрузки статуса необязательным считается привязка уведомлений.
    const optional = props.status
      ? props.status.steps.find((step) => step.key === key)?.required === false
      : key === 'TELEGRAM_LINK'
    return {
      key,
      index: optional ? null : ++number,
      label: onboardingStepLabel(key),
      done:
        key === 'ORGANIZATION' ? props.status !== null : isOnboardingStepDone(props.status, key),
      current: key === props.current,
      optional,
    }
  })
})
</script>

<template>
  <nav aria-label="Шаги начала работы">
    <ol class="flex flex-col gap-4">
      <li v-for="step in steps" :key="step.key" class="flex items-center gap-3">
        <span
          :class="[
            'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            step.done
              ? 'bg-brand text-white'
              : step.current
                ? 'border-2 border-brand text-brand-dark'
                : 'border border-line text-muted',
          ]"
          aria-hidden="true"
        >
          <UiIcon v-if="step.done" name="check" class="size-5" />
          <UiIcon v-else-if="step.optional" name="notifications" class="size-4.5" />
          <template v-else>{{ step.index }}</template>
        </span>
        <span class="flex flex-col">
          <span
            :class="[
              'text-sm font-semibold',
              step.current || step.done ? 'text-ink' : 'text-muted',
            ]"
            :aria-current="step.current ? 'step' : undefined"
          >
            {{ step.label }}
          </span>
          <span v-if="step.optional" class="text-xs text-muted">необязательно</span>
        </span>
        <span class="sr-only">{{
          step.done ? 'выполнено' : step.current ? 'текущий шаг' : ''
        }}</span>
      </li>
    </ol>
  </nav>
</template>
