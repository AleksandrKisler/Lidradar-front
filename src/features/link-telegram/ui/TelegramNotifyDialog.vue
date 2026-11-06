<script setup lang="ts">
/**
 * Окно «Уведомления в Telegram» (Figma «Уведомления в Telegram» и состояния «Ошибка», «Проверяем»,
 * «Загрузка», «Подключено»). Необязательная личная привязка текущего пользователя: открывается из
 * шага «Источник сообщений» и не связана с подключением источника переписки.
 *
 * Пока привязки нет, окно при открытии выпускает одноразовую ссылку само — как показывает макет
 * (кнопка «Открыть бота» сразу доступна); повторно её выпускает «Обновить ссылку». Содержимое
 * живёт только пока окно открыто: закрытие обрывает опрос и забывает ссылку.
 */
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiChannelMark, UiSheetDialog, UiSkeleton } from '@/shared/ui'
import {
  isSafeStartUrl,
  TELEGRAM_LINK_TTL_MINUTES,
  useTelegramLinkQuery,
} from '@/entities/notification'
import { useTelegramLink } from '../model/use-telegram-link'

const props = defineProps<{ tenantId: string }>()
const emit = defineEmits<{ close: [] }>()

const status = useTelegramLinkQuery(toRef(props, 'tenantId'))
const link = useTelegramLink(() => props.tenantId)

const linked = computed(() => status.data.value?.linked ?? false)
const activeToken = computed(() =>
  link.token.value && !link.expired.value ? link.token.value : null,
)
/** Ссылка вставляется в `href` только со схемой Telegram. */
const startUrl = computed(() =>
  activeToken.value && isSafeStartUrl(activeToken.value.startUrl)
    ? activeToken.value.startUrl
    : null,
)
const error = computed(() => link.issue.error.value ?? link.check.error.value)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))
const checkedNotLinked = computed(() => link.check.data.value === false)

// Остаток срока ссылки обновляется раз в десять секунд: точность до минуты достаточна.
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 10_000)
onBeforeUnmount(() => clearInterval(clock))
watch(activeToken, () => (now.value = Date.now()))
const minutesLeft = computed(() => {
  if (!activeToken.value) return 0
  const left = Math.ceil((new Date(activeToken.value.expiresAt).getTime() - now.value) / 60_000)
  return Number.isFinite(left) ? Math.max(1, left) : TELEGRAM_LINK_TTL_MINUTES
})
function minutesWord(count: number): string {
  const tail = count % 100
  if (tail >= 11 && tail <= 14) return 'минут'
  if (count % 10 === 1) return 'минуту'
  if (count % 10 >= 2 && count % 10 <= 4) return 'минуты'
  return 'минут'
}

/** Одна автоматическая выдача на открытие; дальше — только по кнопке. */
let autoIssued = false
// Ссылка выпускается по свежему статусу: кэш прошлого открытия мог устареть.
watch(
  () => [status.data.value, status.isFetching.value] as const,
  ([value, fetching]) => {
    if (autoIssued || fetching || !value || value.linked) return
    autoIssued = true
    link.issue.mutate()
  },
  { immediate: true },
)

const expiredView = link.expired
</script>

<template>
  <UiSheetDialog
    :open="true"
    title="Уведомления в Telegram"
    description="Личная привязка · Необязательная настройка"
    size="md"
    @update:open="(value: boolean) => !value && emit('close')"
  >
    <template #mark><UiChannelMark kind="telegram" /></template>

    <div class="flex flex-col gap-4">
      <p class="text-sm text-secondary">
        Личная привязка: бот сообщает о рисках и даёт ссылку на рабочий контекст. Подтверждение
        оплаты выполняется только в LidRadar.
      </p>

      <UiAlert
        v-if="status.isError.value"
        tone="danger"
        title="Не удалось прочитать статус привязки"
      >
        Повторите попытку позже: настройки уведомлений при этом сохраняются.
        <UiButton
          variant="secondary"
          size="sm"
          class="mt-3"
          :loading="status.isFetching.value"
          @click="status.refetch()"
        >
          Повторить
        </UiButton>
      </UiAlert>

      <template v-else-if="status.isPending.value">
        <p class="text-sm text-ink">
          Откройте бота по одноразовой ссылке и нажмите «Начать». Вернитесь сюда — состояние
          обновится после привязки.
        </p>
        <div class="flex flex-col gap-3 md:flex-row" role="status" aria-label="Загружаем статус">
          <UiSkeleton class="h-input md:flex-1" />
          <UiSkeleton class="h-input md:flex-1" />
        </div>
        <UiSkeleton class="h-2.5 w-full" />
      </template>

      <div
        v-else-if="linked"
        class="rounded-control bg-success-pale px-4 py-3 text-sm text-ink"
        role="status"
      >
        <p class="font-medium text-success">Уведомления успешно подключены</p>
        <p>Бот будет сообщать о рисках в вашем личном Telegram.</p>
      </div>

      <template v-else>
        <p v-if="expiredView" class="text-sm text-ink">
          Срок действия ссылки истёк. Получите новую ссылку и повторите привязку.
        </p>
        <p v-else class="text-sm text-ink">
          Откройте бота по одноразовой ссылке и нажмите «Начать». Вернитесь сюда — состояние
          обновится после привязки.
        </p>
        <UiAlert v-if="expiredView" tone="danger" title="Ссылка больше не действует">
          Создайте новую одноразовую ссылку. Остальные настройки сохранятся.
        </UiAlert>
        <UiAlert
          v-else-if="activeToken && !startUrl"
          tone="danger"
          title="Ссылка привязки непригодна"
        >
          Сервер вернул адрес с неожиданной схемой, он не будет открыт. Выпустите новую ссылку.
        </UiAlert>
        <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
          {{ errorView.description }}
        </UiAlert>

        <div class="flex flex-col gap-3 md:flex-row">
          <a
            v-if="startUrl"
            :href="startUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-input items-center justify-center rounded-button bg-brand px-6 text-field font-medium text-white hover:bg-brand-dark md:flex-1"
          >
            Открыть бота
          </a>
          <UiButton
            v-else
            class="md:flex-1"
            :loading="link.issue.isPending.value"
            @click="link.issue.mutate()"
          >
            Обновить ссылку
          </UiButton>
          <UiButton
            :variant="link.check.isPending.value ? 'primary' : 'secondary'"
            class="md:flex-1"
            :loading="link.check.isPending.value"
            @click="link.check.mutate()"
          >
            {{ link.check.isPending.value ? 'Проверяем…' : 'Проверить привязку' }}
          </UiButton>
        </div>
        <p class="text-xs text-secondary">
          <template v-if="activeToken"
            >Ссылка действует ещё {{ minutesLeft }} {{ minutesWord(minutesLeft) }}.</template
          >
          <template v-else
            >Одноразовая ссылка действует {{ TELEGRAM_LINK_TTL_MINUTES }} минут.</template
          >
        </p>
        <p v-if="checkedNotLinked" class="text-xs text-secondary" role="status">
          Привязка ещё не завершена: откройте бота и нажмите «Начать», затем проверьте снова.
        </p>
        <p v-else-if="link.pollsExhausted.value" class="text-xs text-secondary" role="status">
          Автоматическая проверка остановлена — нажмите «Проверить привязку» после подтверждения в
          боте.
        </p>
      </template>

      <section class="flex flex-col gap-2 rounded-[20px] bg-canvas px-6 py-[18px]">
        <h3 class="text-field font-semibold text-ink">Что не меняется</h3>
        <p class="text-sm text-ink">
          Отключение уведомлений не останавливает поиск рисков и не удаляет их из Radar.
        </p>
        <p class="text-sm text-secondary">
          Сбой доставки в Telegram также не меняет состояние риска.
        </p>
      </section>
    </div>

    <template #note>
      {{
        linked
          ? 'Привязка действует для вашего аккаунта.'
          : 'Личные уведомления можно настроить позже.'
      }}
    </template>
    <template #footer>
      <UiButton :variant="linked ? 'primary' : 'secondary'" @click="emit('close')">
        {{ linked ? 'Готово' : 'Закрыть' }}
      </UiButton>
    </template>
  </UiSheetDialog>
</template>
