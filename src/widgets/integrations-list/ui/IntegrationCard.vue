<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiButton, UiSheetDialog, UiGlyph } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  connectionErrorLabel,
  connectionStatusView,
  providerLabel,
  useConnectionHealthQuery,
  type ChannelConnection,
} from '@/entities/integration'
import { TelegramInstructionDialog } from '@/features/connect-channel'
import { useCheckChannelHealth } from '@/features/check-channel-health'
import { useDisconnectChannel } from '@/features/disconnect-channel'
import IntegrationBanner from './IntegrationBanner.vue'
import telegram from './assets/telegram.svg?no-inline'
import checkIcon from './assets/check.svg?no-inline'
import partialIcon from './assets/partial.svg?no-inline'
import warningIcon from './assets/warning.svg?no-inline'
import disconnectedIcon from './assets/disconnected.svg?no-inline'
import warningBody from './assets/body-warning.svg?no-inline'
import dangerBody from './assets/body-danger.svg?no-inline'
import localCheck from './assets/local-check.svg?no-inline'

const props = defineProps<{
  tenantId: string
  connection: ChannelConnection
  locationName: string | null
  timeZone: string | null
}>()
const session = useSessionStore()
const permitted = computed(
  () => session.tenantId === props.tenantId && session.can('integration.manage'),
)
const health = useConnectionHealthQuery(
  () => (permitted.value ? props.tenantId : null),
  () => props.connection.id,
)
const check = useCheckChannelHealth(
  () => props.tenantId,
  () => props.connection.id,
)
const disconnect = useDisconnectChannel(
  () => props.tenantId,
  () => props.connection.id,
)
const instructionOpen = ref(false)
const confirmOpen = ref(false)
const cardElement = ref<HTMLLIElement | null>(null)
const returnFromInstruction = () =>
  permitted.value
    ? (cardElement.value?.querySelector<HTMLElement>('.source-instruction:not(:disabled)') ?? null)
    : null
function openInstruction(event: MouseEvent): void {
  // WebKit pointer activation must retain the same opener as keyboard activation.
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus({ preventScroll: true })
  instructionOpen.value = true
}
const returnFromConfirmation = () =>
  permitted.value
    ? (cardElement.value?.querySelector<HTMLElement>(
        '.source-disconnect:not(:disabled), .source-instruction',
      ) ?? cardElement.value)
    : null
const telegramSource = computed(() => props.connection.provider === 'CONNECTED_BUSINESS_BOT')
const provider = computed(() =>
  telegramSource.value ? 'Telegram' : providerLabel(props.connection.provider),
)
const snapshot = computed(() => health.data.value ?? props.connection)
const partial = computed(
  () => disconnect.outcome.value === 'partial' || disconnect.outcome.value === 'retried',
)
const disconnected = computed(
  () =>
    disconnect.outcome.value !== null ||
    snapshot.value.status === 'DISCONNECTED' ||
    props.connection.status === 'DISCONNECTED',
)
const status = computed(() => {
  if (disconnected.value) return { label: 'Отключено', tone: partial.value ? 'danger' : 'neutral' }
  if (snapshot.value.status === 'ACTIVE' && telegramSource.value)
    return {
      label: 'Активно',
      tone: check.result.value?.verification === 'LOCAL' ? 'neutral' : 'success',
    }
  if (snapshot.value.status === 'DEGRADED') return { label: 'Требует внимания', tone: 'warning' }
  return connectionStatusView(props.connection.provider, snapshot.value)
})
const busy = computed(() => check.isPending.value || disconnect.isPending.value)
const noEvents = computed(
  () => !disconnected.value && snapshot.value.status === 'ACTIVE' && !snapshot.value.lastEventAt,
)
const sourceError = computed(() => !disconnected.value && snapshot.value.status === 'ERROR')
const sourceErrorText = computed(() =>
  telegramSource.value && snapshot.value.lastErrorCode === 'TELEGRAM_WEBHOOK_MISMATCH'
    ? 'Регистрация бота не совпадает с настройкой LidRadar. Откройте инструкцию и проверьте настройки Telegram.'
    : snapshot.value.lastErrorCode
      ? connectionErrorLabel(snapshot.value.lastErrorCode)
      : 'Источник сообщил об ошибке. Проверьте настройки подключения.',
)
const readAt = computed(() => health.data.value?.checkedAt ?? null)
const remoteSuccess = computed(
  () =>
    check.result.value?.verification === 'REMOTE' && check.result.value.health.status === 'ACTIVE',
)
function when(value: string | null) {
  return value
    ? props.timeZone
      ? (formatDateTime(value, props.timeZone) ?? 'Дата недоступна')
      : 'Часовой пояс не загружен'
    : 'Ещё не было'
}
async function confirmDisconnect() {
  await disconnect.run()
  if (!disconnect.error.value) {
    confirmOpen.value = false
    check.reset()
  }
}
watch(
  () => [props.tenantId, props.connection.id, session.user?.id, session.tenantId, session.role],
  () => {
    instructionOpen.value = false
    confirmOpen.value = false
  },
  { flush: 'sync' },
)
</script>

<template>
  <li
    v-if="permitted"
    ref="cardElement"
    tabindex="-1"
    class="integration-card"
    :data-connection-id="connection.id"
    :aria-label="connection.name || provider"
    :aria-busy="busy || undefined"
  >
    <div class="source-header">
      <div class="source-identity">
        <span v-if="telegramSource" class="telegram-mark"
          ><img :src="telegram" width="24" height="24" alt=""
        /></span>
        <span v-else class="source-mark"><UiGlyph name="nav-integrations" class="size-6" /></span>
        <div class="min-w-0 flex-1">
          <h3 class="source-name">{{ connection.name || provider }}</h3>
          <p class="source-provider">{{ provider }} · {{ locationName ?? 'Вся организация' }}</p>
        </div>
      </div>
      <span
        class="source-status"
        :class="`source-status--${status.tone}`"
        data-testid="source-status"
      >
        <img v-if="status.tone === 'success'" :src="checkIcon" width="14" height="14" alt="" />
        <img
          v-else-if="telegramSource && status.label === 'Активно' && status.tone === 'neutral'"
          :src="localCheck"
          width="14"
          height="14"
          alt=""
        />
        <img
          v-else-if="status.tone === 'danger'"
          :src="partialIcon"
          width="14"
          height="14"
          alt=""
        />
        <img
          v-else-if="status.tone === 'warning'"
          :src="warningIcon"
          width="14"
          height="14"
          alt=""
        />
        <img v-else-if="disconnected" :src="disconnectedIcon" width="14" height="14" alt="" />
        <span v-else class="status-dot" aria-hidden="true" />{{ status.label }}
      </span>
    </div>
    <dl class="source-metadata">
      <div>
        <dt>Последнее событие</dt>
        <dd>{{ when(snapshot.lastEventAt) }}</dd>
      </div>
      <div>
        <dt>Успешная операция</dt>
        <dd>{{ when(snapshot.lastSuccessAt) }}</dd>
      </div>
      <div>
        <dt>Последняя ошибка</dt>
        <dd>{{ when(snapshot.lastErrorAt) }}</dd>
      </div>
    </dl>
    <hr class="source-divider" />
    <div v-if="partial" class="source-result" role="status">
      <p class="source-inline source-inline--danger">
        <img :src="dangerBody" width="20" height="20" alt="" />Источник отключён в LidRadar
      </p>
      <p>
        {{
          telegramSource
            ? 'Удаление настройки у Telegram не подтверждено. Повторите отключение, чтобы завершить его.'
            : 'Удалённое отключение не подтверждено. Повторите отключение, чтобы завершить его.'
        }}
      </p>
    </div>
    <IntegrationBanner
      v-else-if="sourceError"
      :icon="false"
      :title="
        telegramSource && snapshot.lastErrorCode === 'TELEGRAM_WEBHOOK_MISMATCH'
          ? 'Настройка Telegram изменилась'
          : 'Ошибка источника'
      "
      :description="sourceErrorText"
    />
    <div
      v-else-if="!disconnected && snapshot.status === 'DEGRADED'"
      class="source-result"
      role="status"
    >
      <p class="source-inline source-inline--warning">
        <img :src="warningBody" width="20" height="20" alt="" />Подключение требует внимания
      </p>
      <p>Не удалось подтвердить настройку {{ provider }}. Последние известные данные сохранены.</p>
    </div>
    <IntegrationBanner v-if="check.error.value" title="Не удалось проверить связь" />
    <IntegrationBanner
      v-if="health.isError.value && !check.result.value"
      title="Не удалось прочитать состояние"
      description="Показаны последние известные данные. Повторите чтение состояния."
    >
      <button
        type="button"
        class="min-h-11 self-start text-link"
        :disabled="health.isFetching.value"
        @click="health.refetch()"
      >
        Повторить чтение
      </button>
    </IntegrationBanner>
    <div v-if="disconnected && !partial" class="source-result" role="status">
      <p class="font-medium">Новые сообщения не поступают</p>
      <p>Сохранённые диалоги и риски остаются доступны.</p>
    </div>
    <div v-if="noEvents && !check.result.value" class="source-result" role="status">
      <p class="font-medium">Новых событий пока нет</p>
      <p>Отправьте сообщение в доступный боту чат и обновите экран.</p>
    </div>
    <div
      v-if="check.result.value && !disconnected"
      class="source-result"
      role="status"
      aria-live="polite"
    >
      <template v-if="check.result.value.verification === 'LOCAL'"
        ><p class="font-medium">Показано сохранённое состояние</p>
        <p>Удалённая проверка не выполнялась.</p></template
      >
      <template v-else-if="remoteSuccess"
        ><p class="source-remote-success">Связь с {{ provider }} проверена</p>
        <p>Регистрация подтверждена. Получение сообщений проверьте на новом сообщении.</p></template
      >
      <template v-else
        ><p class="font-medium">Удалённая проверка выполнена</p>
        <p>
          Источник {{ snapshot.status === 'ERROR' ? 'сообщил об ошибке' : 'требует внимания' }}.
          Получение сообщений не подтверждено.
        </p></template
      >
    </div>
    <p v-if="disconnect.outcome.value === 'retried'" class="text-sm text-secondary" role="status">
      Повтор выполнен. Удаление настройки у Telegram не подтверждено.
    </p>
    <div
      class="source-actions"
      :class="{
        'source-actions--partial': partial,
        'source-actions--checking': check.isPending.value,
      }"
    >
      <UiButton
        v-if="!disconnected"
        variant="secondary"
        class="source-check"
        :loading="check.isPending.value"
        :disabled="disconnect.isPending.value"
        @click="check.run()"
        >{{
          check.isPending.value
            ? 'Проверяем…'
            : telegramSource
              ? 'Проверить связь'
              : 'Обновить статус'
        }}</UiButton
      >
      <UiButton
        v-else-if="partial"
        variant="secondary"
        class="source-check"
        :loading="disconnect.isPending.value"
        @click="disconnect.run()"
        >Повторить отключение</UiButton
      >
      <UiButton
        v-if="telegramSource"
        variant="ghost"
        class="source-instruction"
        @click="openInstruction"
        >Инструкция</UiButton
      >
      <UiButton
        v-if="!disconnected"
        variant="plain"
        class="source-disconnect"
        :disabled="busy"
        @click="confirmOpen = true"
        >Отключить</UiButton
      >
    </div>
    <p class="source-read" aria-live="polite">
      <template v-if="!timeZone && (readAt || check.result.value)"
        >Часовой пояс не загружен</template
      >
      <template v-else-if="check.result.value?.verification === 'REMOTE' && !disconnected"
        >Проверка выполнена {{ when(check.result.value.health.checkedAt) }}</template
      >
      <template v-else-if="readAt">Состояние прочитано {{ when(readAt) }}</template>
      <template v-else>Состояние из списка подключений.</template>
    </p>
    <TelegramInstructionDialog
      v-if="instructionOpen"
      v-model:open="instructionOpen"
      adaptive
      overlay
      :return-focus="returnFromInstruction"
    />
    <UiSheetDialog
      v-model:open="confirmOpen"
      title="Отключить источник?"
      :description="connection.name || provider"
      entity-form
      description-in-body
      footer-fill
      size="sm"
      :return-focus="returnFromConfirmation"
      :dismissible="!disconnect.isPending.value"
    >
      <p class="text-sm leading-5 text-ink">
        Новые сообщения перестанут поступать. Сохранённые диалоги и риски останутся доступны.
      </p>
      <IntegrationBanner
        v-if="disconnect.error.value"
        title="Не удалось подтвердить отключение"
        description="Результат запроса неизвестен. Повторите попытку; удаление настройки у провайдера не подтверждено."
      />
      <template #footer
        ><UiButton
          variant="secondary"
          :disabled="disconnect.isPending.value"
          @click="confirmOpen = false"
          >Отмена</UiButton
        ><UiButton
          variant="secondary"
          style="color: var(--color-danger)"
          :loading="disconnect.isPending.value"
          @click="confirmDisconnect"
          >{{ disconnect.isPending.value ? 'Отключаем…' : 'Отключить' }}</UiButton
        ></template
      >
    </UiSheetDialog>
    <IntegrationBanner
      v-if="partial && disconnect.error.value"
      title="Не удалось повторить отключение"
      description="Локальное отключение сохраняется. Удаление настройки у провайдера не подтверждено."
    />
  </li>
</template>

<style scoped>
.integration-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--color-analytics-line);
  border-radius: var(--radius-card);
  background: var(--color-paper);
  overflow-wrap: anywhere;
}
.source-header,
.source-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.source-identity {
  flex: 1;
}
.telegram-mark,
.source-mark {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: #0088cc;
}
.source-mark {
  background: var(--color-action-pale);
  color: var(--color-brand);
}
.source-name {
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}
.source-provider {
  margin-top: 2px;
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  color: var(--color-secondary);
}
.source-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 9999px;
  font-size: 12px;
  line-height: 18px;
  flex-shrink: 0;
  background: var(--color-segment);
  color: var(--color-muted);
}
.source-status--success {
  color: var(--color-success);
  background: var(--color-success-pale);
}
.source-status--danger {
  color: var(--color-danger);
  background: var(--color-danger-pale);
}
.source-status--warning {
  color: var(--color-warning);
  background: var(--color-warning-pale);
}
.source-status--info {
  color: var(--color-info);
  background: var(--color-info-pale);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.source-metadata {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.source-metadata dt {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
.source-metadata dd {
  margin-top: 4px;
  font-size: 15px;
  line-height: 22px;
}
.source-divider {
  border: 0;
  height: 1px;
  background: var(--color-analytics-line);
}
.source-actions {
  display: grid;
  grid-template-columns: minmax(0, 228px) minmax(0, 148px) 1fr;
  align-items: center;
  gap: 8px;
}
.source-disconnect {
  justify-self: end;
  color: var(--color-danger);
  padding-inline: 24px;
}
.source-check,
.source-instruction {
  max-width: 100%;
  padding-inline: 12px;
}
.source-read {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-secondary);
}
.source-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-secondary);
}
.source-result .font-medium {
  color: var(--color-ink);
}
@media (max-width: 767px) {
  .integration-card {
    padding: 16px;
  }
  .source-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .source-status {
    align-self: flex-start;
    margin-left: 52px;
  }
  .source-metadata {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .source-metadata dd {
    margin-top: 12px;
  }
  .source-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .source-check {
    grid-column: 1/-1;
    width: 100%;
  }
  .source-disconnect {
    width: 100%;
    padding-inline: 0;
  }
  .source-instruction {
    width: 100%;
    padding-inline: 0;
  }
}
.source-inline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.source-inline img {
  flex-shrink: 0;
}
.source-inline--danger {
  color: var(--color-danger);
}
.source-inline--warning {
  color: var(--color-warning);
}
.source-result .source-remote-success {
  color: var(--color-success);
  font-weight: 400;
}
.source-actions--checking .source-check {
  color: var(--color-brand);
}
.source-actions--checking .source-disconnect {
  color: var(--color-muted);
  opacity: 1;
}
.source-actions--partial {
  grid-template-columns: minmax(0, 254px);
}
.source-actions--partial .source-instruction {
  width: 148px;
}
@media (max-width: 767px) {
  .source-identity {
    align-items: flex-start;
  }
  .source-actions--partial {
    grid-template-columns: minmax(0, 1fr);
  }
  .source-actions--partial .source-instruction {
    width: 148px;
  }
}
</style>
