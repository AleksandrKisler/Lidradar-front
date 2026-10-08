<script setup lang="ts">
/**
 * Шаг 4: источник сообщений и итог настройки. Подключение выполняется в
 * разделе «Интеграции»; страница честно показывает серверный статус и не
 * объявляет настройку завершённой, пока обязательные шаги не выполнены.
 * Личная привязка Telegram — необязательный шаг на этой же странице.
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiAlert, UiButton, UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { TelegramLinkCard } from '@/features/link-telegram'
import {
  ONBOARDING_STEP_ORDER,
  isOnboardingStepDone,
  onboardingStepLabel,
  useOnboardingQuery,
} from '@/entities/organization'

const router = useRouter()
const session = useSessionStore()
const status = useOnboardingQuery(() => session.tenantId)
const organization = useOrganizationQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

const channelDone = computed(() => isOnboardingStepDone(status.data.value ?? null, 'CHANNEL'))

const rows = computed(() =>
  ONBOARDING_STEP_ORDER.map((key) => ({
    key,
    label: onboardingStepLabel(key),
    done: key === 'ORGANIZATION' ? true : isOnboardingStepDone(status.data.value ?? null, key),
    required: status.data.value?.steps.find((step) => step.key === key)?.required ?? true,
  })),
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="text-xs font-semibold tracking-wide text-brand-dark">Шаг 4 из 4</p>
      <h1 class="mt-2 text-2xl font-bold text-ink">Источник сообщений</h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        Риски появятся, когда LidRadar начнёт получать переписку из подключённого канала.
      </p>
    </div>

    <UiCard as="section" aria-labelledby="status-title">
      <h2 id="status-title" class="text-lg font-bold text-ink">Что уже настроено</h2>
      <div v-if="status.isPending.value" class="mt-4" role="status" aria-label="Загрузка статуса">
        <UiSkeleton class="h-24 w-full" />
      </div>
      <UiErrorState
        v-else-if="status.isError.value"
        class="mt-4"
        :error="status.error.value"
        title="Не удалось загрузить статус"
        @retry="status.refetch()"
      />
      <ul v-else class="mt-4 divide-y divide-line" aria-label="Шаги настройки">
        <li
          v-for="row in rows"
          :key="row.key"
          class="flex items-center justify-between gap-4 py-2.5 text-sm"
        >
          <span class="text-ink">
            {{ row.label }}
            <span v-if="!row.required" class="text-muted">· необязательно</span>
          </span>
          <span :class="row.done ? 'font-semibold text-success' : 'text-muted'">
            {{ row.done ? 'готово' : 'не выполнено' }}
          </span>
        </li>
      </ul>
    </UiCard>

    <UiAlert v-if="status.data.value?.complete" tone="success" title="Настройка завершена">
      Обязательные шаги выполнены. Для webhook завершите настройку отправителя по инструкции в
      «Интеграциях». Radar начнёт анализ после получения сообщений.
    </UiAlert>
    <UiAlert v-else-if="channelDone" tone="info" title="Источник подключён">
      Подключение создано. Проверьте оставшиеся шаги выше и первый приём сообщения в «Интеграциях».
    </UiAlert>

    <UiAlert v-else tone="info" title="Подключите источник сообщений">
      Без источника Radar работает, но рисков не будет. Подключение Telegram или webhook выполняется
      в разделе «Интеграции».
      <RouterLink
        :to="{ name: 'integrations' }"
        class="ml-1 font-semibold text-brand-dark hover:underline"
      >
        Перейти к подключению
      </RouterLink>
    </UiAlert>

    <RouterLink
      v-if="channelDone"
      :to="{ name: 'integrations' }"
      class="font-semibold text-brand-dark hover:underline"
    >
      Инструкция и статус подключения
    </RouterLink>

    <UiCard v-if="session.tenantId">
      <TelegramLinkCard :tenant-id="session.tenantId" :time-zone="timeZone" />
      <p class="mt-3 text-xs text-muted">
        Необязательно: личные уведомления можно настроить позже.
      </p>
    </UiCard>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <RouterLink
        :to="{ name: 'onboarding-services' }"
        class="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
      >
        Назад
      </RouterLink>
      <UiButton @click="router.push({ name: 'radar' })">Перейти в Radar</UiButton>
    </div>
  </div>
</template>
