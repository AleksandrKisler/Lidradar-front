<script setup lang="ts">
/**
 * Шаг 4 по макету «Источник сообщений» (Figma 477:8322 и состояния «Подключён», «Всё подключено»).
 * Подключение выполняется здесь же, в том же диалоге, что и в «Интеграциях»: уходить из мастера не нужно.
 * Пока источника нет, главное действие страницы — подключить его, а выход в Radar подписан честно:
 * без источника рисков не будет. Страница показывает серверный статус и не объявляет настройку
 * завершённой, пока обязательные шаги не выполнены. Личная привязка Telegram необязательна:
 * ссылка «Уведомления в Telegram» открывает её в окне. MAX в макете — недоступная карточка «В работе».
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { UiButton, UiChannelMark, UiIcon, UiPageIntro } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useLocationsQuery } from '@/entities/location'
import { connectionStatusLabel, useConnectionsQuery } from '@/entities/integration'
import { ConnectChannelDialog } from '@/features/connect-channel'
import { TelegramNotifyDialog } from '@/features/link-telegram'
import { isOnboardingStepDone, useOnboardingQuery } from '@/entities/organization'

const router = useRouter()
const session = useSessionStore()
const tenantId = computed(() => session.tenantId ?? '')
const status = useOnboardingQuery(() => session.tenantId)
const locations = useLocationsQuery(() => session.tenantId)

/** Подключать источники может только тот, у кого есть право на «Интеграции». */
const canConnect = computed(() => session.can('integration.manage'))
const connections = useConnectionsQuery(() => (canConnect.value ? session.tenantId : null))
const live = computed(() =>
  (connections.data.value ?? []).filter((item) => item.status !== 'DISCONNECTED'),
)
const connection = computed(
  () =>
    live.value.find((item) => item.provider === 'CONNECTED_BUSINESS_BOT') ?? live.value[0] ?? null,
)

/** Явная повторная проверка («Повторить проверку»): фоновые обновления кнопку не трогают. */
const retrying = ref(false)
/** Повторное чтение после сбоя снова переводит запрос в «ожидание»: пока идёт явный повтор, каркас не возвращается. */
const loading = computed(() => status.isPending.value && !retrying.value)
/** Сбой чтения статуса или подключений: источник неизвестен, предлагается повторить проверку. */
const failed = computed(
  () => status.isError.value || (canConnect.value && connections.isError.value),
)
const channelDone = computed(() => isOnboardingStepDone(status.data.value ?? null, 'CHANNEL'))
const linked = computed(() => isOnboardingStepDone(status.data.value ?? null, 'TELEGRAM_LINK'))
/** «Слушает входящие» — только у работающего подключения; иначе честно показывается его состояние. */
const healthy = computed(() => connection.value?.status === 'ACTIVE')
/** Подключение известно и не работает: без данных о подключении (нет права, сбой чтения) о состоянии ничего не утверждается. */
const needsAttention = computed(() => connection.value !== null && !healthy.value)
const statusLabel = computed(() =>
  connection.value ? connectionStatusLabel(connection.value.status) : '',
)

const description = computed(() => {
  if (!channelDone.value) {
    return 'Риски появятся, когда LidRadar начнёт получать переписку.\nПока источник не подключён, лента рисков пустая.'
  }
  if (needsAttention.value) {
    return 'Источник подключён, но работает не полностью.\nСостояние и инструкция — в разделе «Интеграции».'
  }
  if (!healthy.value) return 'Источник подключён. Состояние и инструкция — в разделе «Интеграции».'
  return linked.value
    ? 'Бот подключён к автоматизации чатов Telegram.\nLidRadar получает входящие сообщения из выбранных чатов.'
    : 'Бот подключён и слушает входящие сообщения из выбранных чатов. Личные уведомления можно подключить отдельно.'
})

const connectOpen = ref(false)
const notifyOpen = ref(false)
const sourceTitle = ref<HTMLElement | null>(null)

// Кнопка подключения исчезает вместе с состоянием «источника нет»: после
// закрытия диалога фокус переходит на заголовок нового состояния.
watch(connectOpen, async (isOpen) => {
  if (isOpen || !channelDone.value) return
  await nextTick()
  sourceTitle.value?.focus()
})

async function retry(): Promise<void> {
  retrying.value = true
  try {
    await Promise.all([status.refetch(), canConnect.value ? connections.refetch() : null])
  } finally {
    retrying.value = false
  }
}
function toRadar(): void {
  void router.push({ name: 'radar' })
}
</script>

<template>
  <div>
    <UiPageIntro
      :measure="channelDone && healthy && !linked ? 840 : undefined"
      wide
      title="Источник сообщений"
      :description="description"
    />

    <section
      aria-labelledby="source-title"
      class="rounded-card border border-line bg-paper px-5 py-3.5 md:px-6"
    >
      <template v-if="loading">
        <div class="flex items-center gap-3" role="status" aria-label="Загрузка статуса источника">
          <UiChannelMark kind="telegram" />
          <div class="flex flex-col gap-2.5">
            <div class="h-3 w-[216px] rounded-full bg-line" />
            <div class="h-3 w-[164px] rounded-full bg-line" />
          </div>
        </div>
        <div class="mt-3.5 flex flex-col gap-2.5">
          <div class="h-3 max-w-full rounded-full bg-line md:w-[641px]" />
          <div class="h-3 max-w-full rounded-full bg-line md:w-[484px]" />
          <div class="h-3 w-[252px] rounded-full bg-line md:hidden" />
        </div>
        <div class="mt-2 h-[46px] w-full rounded-button bg-line md:w-[228px]" />
      </template>

      <template v-else-if="channelDone">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="flex items-start gap-3">
            <UiChannelMark kind="telegram" />
            <div>
              <h2
                id="source-title"
                ref="sourceTitle"
                tabindex="-1"
                class="text-field leading-6 font-semibold text-ink focus:outline-none"
              >
                Telegram подключён
              </h2>
              <p class="text-xs leading-[18px] break-words text-secondary">
                Источник переписки<template v-if="connection"> · {{ connection.name }}</template>
              </p>
            </div>
          </div>
          <span
            v-if="connection && !linked"
            :class="[
              'inline-flex w-fit rounded-full px-3 py-1 text-xs leading-[18px] font-medium',
              healthy ? 'bg-success-pale text-success' : 'bg-warning-pale text-warning',
            ]"
          >
            {{ healthy ? 'Слушает входящие' : statusLabel }}
          </span>
        </div>
        <p class="mt-2.5 text-sm leading-5 text-secondary">
          {{
            healthy
              ? 'Бот подключён к автоматизации чатов и получает новые входящие сообщения из выбранных чатов.'
              : needsAttention
                ? 'Подключение требует внимания: проверьте его состояние и инструкцию в «Интеграциях».'
                : 'Состояние подключения смотрите в «Интеграциях».'
          }}
        </p>
        <div v-if="failed" class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <UiButton variant="secondary" :loading="retrying" @click="retry">
            <template v-if="retrying">
              <span aria-hidden="true">Проверяем…</span
              ><span class="sr-only">Повторить проверку</span>
            </template>
            <template v-else>Повторить проверку</template>
          </UiButton>
          <p
            class="flex items-center gap-2.5 text-sm leading-5 font-medium text-danger-ink"
            role="alert"
          >
            <UiIcon name="error" class="size-5 shrink-0" />Не удалось проверить состояние
          </p>
        </div>
        <RouterLink
          :to="{ name: 'integrations' }"
          class="mt-3 inline-block text-sm leading-5 text-link hover:underline"
        >
          Управлять в «Интеграциях»
        </RouterLink>
      </template>

      <template v-else>
        <div class="flex items-center gap-3">
          <UiChannelMark kind="telegram" />
          <div>
            <h2
              id="source-title"
              ref="sourceTitle"
              tabindex="-1"
              class="text-field leading-6 font-semibold text-ink focus:outline-none"
            >
              Подключите Telegram
            </h2>
            <p class="text-meta leading-[18px] text-link">Источник переписки</p>
          </div>
        </div>
        <p class="mt-2.5 text-sm leading-5 text-secondary">
          Подключается переписка бизнес-аккаунта Telegram. Понадобится бот и его токен — инструкция
          находится в окне подключения.
        </p>
        <div
          v-if="failed || retrying"
          class="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:gap-4"
        >
          <UiButton class="w-full md:w-[228px]" :loading="retrying" @click="retry">
            <template v-if="retrying">
              <span aria-hidden="true">Проверяем…</span
              ><span class="sr-only">Повторить проверку</span>
            </template>
            <template v-else>Повторить проверку</template>
          </UiButton>
          <p
            v-if="!retrying"
            class="flex items-center gap-2.5 text-sm leading-5 font-medium text-danger-ink"
            role="alert"
          >
            <UiIcon name="error" class="size-5 shrink-0" />Не удалось проверить подключение
          </p>
        </div>
        <div v-else-if="canConnect" class="mt-2">
          <UiButton class="w-full md:w-[228px]" @click="connectOpen = true">
            Подключить Telegram
          </UiButton>
        </div>
        <p v-else class="mt-3 text-sm leading-5 text-secondary">
          Источник подключает владелец организации в разделе «Интеграции».
        </p>
      </template>
    </section>

    <section
      aria-labelledby="max-title"
      class="mt-4 rounded-card border border-line bg-paper/50 px-5 py-3.5 text-secondary md:px-6"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <UiChannelMark kind="max" />
          <div>
            <h2 id="max-title" class="text-field leading-6 font-semibold">Подключите MAX</h2>
            <p class="text-meta leading-[18px] font-medium">Источник переписки</p>
          </div>
        </div>
        <span class="rounded-full bg-segment px-3 py-1 text-meta leading-[18px] font-medium">
          В работе
        </span>
      </div>
      <p class="mt-3 text-sm leading-5">
        Интеграция с MAX в работе. Подключение переписки станет доступно позже.
      </p>
      <UiButton
        :class="[
          'w-full bg-line! text-muted! opacity-100! md:w-[228px]',
          channelDone ? 'mt-3' : 'mt-[22px]',
        ]"
        variant="secondary"
        disabled
        >Подключить MAX</UiButton
      >
    </section>

    <p class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-secondary">
      <UiIcon
        :name="linked ? 'notifications-filled' : 'notifications'"
        :class="['size-4', linked ? 'text-success' : '']"
      />
      <button type="button" class="text-link hover:underline" @click="notifyOpen = true">
        Уведомления в Telegram
      </button>
      <span>— {{ linked ? 'подключены' : 'личные, необязательно' }}</span>
    </p>
    <p class="mt-4 px-1 text-sm leading-5 text-secondary md:pl-6">
      <template v-if="!channelDone">
        Без источника в LidRadar не появится ни одного риска.<br />
        Подключить его можно позже в разделе «Интеграции».
      </template>
      <template v-else-if="linked">
        Источник и личные уведомления подключены. Можно перейти в Radar.
      </template>
      <template v-else>Источник подключён. Личные уведомления можно настроить позже.</template>
    </p>

    <div
      :class="[
        'mt-4 flex items-center justify-between gap-3 md:flex-row',
        channelDone ? 'flex-col-reverse items-stretch md:items-center' : 'flex-wrap md:flex-nowrap',
      ]"
    >
      <UiButton
        variant="secondary"
        class="md:w-[100px]"
        @click="router.push({ name: 'onboarding-services' })"
      >
        Назад
      </UiButton>
      <UiButton v-if="channelDone" class="md:w-[190px]" @click="toRadar">
        Перейти в Radar
      </UiButton>
      <UiButton v-else variant="plain" class="md:mr-2.5" @click="toRadar">Подключу позже</UiButton>
    </div>

    <ConnectChannelDialog
      v-if="canConnect"
      v-model:open="connectOpen"
      :tenant-id="tenantId"
      :locations="locations.data.value ?? []"
      :loading="locations.isPending.value"
    />
    <TelegramNotifyDialog
      v-if="notifyOpen && session.tenantId"
      :tenant-id="session.tenantId"
      @close="notifyOpen = false"
    />
  </div>
</template>
