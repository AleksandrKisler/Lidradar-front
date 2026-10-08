<script setup lang="ts">
/**
 * Шаг 4: источник сообщений и итог настройки. Подключение выполняется здесь же,
 * в том же диалоге, что и в «Интеграциях»: уходить из мастера не нужно. Пока
 * источника нет, главное действие страницы — подключить его, а выход в Radar
 * подписан честно: без источника рисков не будет. Страница показывает серверный
 * статус и не объявляет настройку завершённой, пока обязательные шаги не
 * выполнены. Личная привязка Telegram необязательна, поэтому у неё тихая кнопка.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiAlert, UiBadge, UiButton, UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useLocationsQuery } from '@/entities/location'
import { connectionStatusView, providerLabel, useConnectionsQuery } from '@/entities/integration'
import { ConnectChannelDialog } from '@/features/connect-channel'
import { TelegramLinkCard } from '@/features/link-telegram'
import {
  ONBOARDING_STEP_ORDER,
  isOnboardingStepDone,
  onboardingStepLabel,
  useOnboardingQuery,
  useOrganizationQuery,
} from '@/entities/organization'

const router = useRouter()
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const status = useOnboardingQuery(() => session.tenantId)
const organization = useOrganizationQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? 'UTC')

/** Подключать источники может только тот, у кого есть право на «Интеграции». */
const canConnect = computed(() => session.can('integration.manage'))
const connections = useConnectionsQuery(() => (canConnect.value ? session.tenantId : null))
const liveConnections = computed(() =>
  (connections.data.value ?? []).filter((item) => item.status !== 'DISCONNECTED'),
)

const channelDone = computed(() => isOnboardingStepDone(status.data.value ?? null, 'CHANNEL'))
const complete = computed(() => status.data.value?.complete === true)

const rows = computed(() =>
  ONBOARDING_STEP_ORDER.map((key) => ({
    key,
    label: onboardingStepLabel(key),
    done: key === 'ORGANIZATION' ? true : isOnboardingStepDone(status.data.value ?? null, key),
    required: status.data.value?.steps.find((step) => step.key === key)?.required ?? true,
  })),
)

const connectOpen = ref(false)
const sourceTitle = ref<HTMLElement | null>(null)

// Кнопка подключения исчезает вместе с состоянием «источника нет»: после
// закрытия диалога фокус переходит на заголовок нового состояния.
watch(connectOpen, async (isOpen) => {
  if (isOpen || !channelDone.value) return
  await nextTick()
  sourceTitle.value?.focus()
})

function toRadar(): void {
  void router.push({ name: 'radar' })
}
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

    <UiCard v-if="status.isPending.value" role="status" aria-label="Загрузка статуса источника">
      <UiSkeleton class="h-6 w-56" />
      <UiSkeleton class="mt-4 h-4 w-full max-w-md" />
      <UiSkeleton class="mt-6 h-11 w-44" />
    </UiCard>

    <UiCard v-else-if="!channelDone" as="section" aria-labelledby="source-title">
      <h2 id="source-title" ref="sourceTitle" tabindex="-1" class="text-lg font-bold text-ink">
        Подключите источник
      </h2>
      <p class="mt-1 text-sm text-muted">
        Radar ищет риски в переписке с клиентами. Пока источника нет, лента рисков остаётся пустой.
      </p>
      <ul class="mt-4 flex flex-col gap-2 text-sm text-ink">
        <li>
          <span class="font-medium">Telegram</span> подходит для бизнес-аккаунта. Понадобится бот и
          его токен, подсказка есть прямо в окне подключения.
        </li>
        <li>
          <span class="font-medium">Webhook</span> подходит для вашей CRM или сайта. Его настраивает
          разработчик, ему пригодится готовая инструкция.
        </li>
      </ul>
      <div v-if="canConnect" class="mt-5">
        <UiButton @click="connectOpen = true">Подключить источник</UiButton>
      </div>
      <p v-else class="mt-5 text-sm text-muted">
        Источник подключает владелец организации в разделе «Интеграции».
      </p>
    </UiCard>

    <UiCard v-else as="section" aria-labelledby="source-title">
      <h2 id="source-title" ref="sourceTitle" tabindex="-1" class="text-lg font-bold text-ink">
        Источник подключён
      </h2>
      <ul
        v-if="liveConnections.length"
        class="mt-3 divide-y divide-line"
        aria-label="Подключённые источники"
      >
        <li
          v-for="connection in liveConnections"
          :key="connection.id"
          class="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
        >
          <span class="min-w-0">
            <span class="font-medium break-words text-ink">{{ connection.name }}</span>
            <span class="text-muted"> · {{ providerLabel(connection.provider) }}</span>
          </span>
          <UiBadge :tone="connectionStatusView(connection.provider, connection).tone">
            {{ connectionStatusView(connection.provider, connection).label }}
          </UiBadge>
        </li>
      </ul>
      <p v-else class="mt-1 text-sm text-muted">Подключение создано.</p>
      <RouterLink
        :to="{ name: 'integrations' }"
        class="mt-3 inline-flex font-medium text-brand-dark hover:underline"
      >
        Статус и инструкция в «Интеграциях»
      </RouterLink>
    </UiCard>

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

    <UiAlert v-if="complete" tone="success" title="Настройка завершена">
      Обязательные шаги выполнены. Для webhook завершите настройку отправителя по инструкции в
      «Интеграциях». Radar начнёт анализ после получения сообщений.
    </UiAlert>
    <UiAlert v-else-if="channelDone" tone="info" title="Источник подключён">
      Настройка ещё не завершена: посмотрите, какие шаги не выполнены, в списке выше. Первый приём
      сообщения можно проверить в «Интеграциях».
    </UiAlert>

    <UiCard v-if="session.tenantId">
      <TelegramLinkCard :tenant-id="session.tenantId" :time-zone="timeZone" quiet />
      <p class="mt-3 text-xs text-muted">
        Необязательно: личные уведомления можно настроить позже.
      </p>
    </UiCard>

    <p v-if="!status.isPending.value && !channelDone" class="text-sm text-muted">
      Без источника в Radar не появится ни одного риска. Подключить его можно и позже, в разделе
      «Интеграции».
    </p>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <RouterLink
        :to="{ name: 'onboarding-services' }"
        class="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
      >
        Назад
      </RouterLink>
      <UiButton v-if="channelDone" @click="toRadar">Перейти в Radar</UiButton>
      <UiButton v-else variant="secondary" @click="toRadar">Подключу позже</UiButton>
    </div>

    <ConnectChannelDialog
      v-if="canConnect"
      v-model:open="connectOpen"
      :tenant-id="tenantId"
      :locations="locations.data.value ?? []"
    />
  </div>
</template>
