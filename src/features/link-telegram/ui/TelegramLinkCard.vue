<script setup lang="ts">
/**
 * Личная привязка Telegram текущего пользователя (макет 05): статус,
 * одноразовая ссылка на бота, проверка привязки и отключение с
 * подтверждением. Не путать с подключением источника переписки.
 *
 * `quiet` ставит рядом со страничным главным действием: кнопка вторичная,
 * чтобы необязательные уведомления не спорили с обязательным подключением.
 */
import { computed, ref, toRef } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { formatDateTime, formatRelative } from '@/shared/lib'
import { UiAlert, UiBadge, UiButton, UiDialog, UiSkeleton } from '@/shared/ui'
import { isSafeStartUrl, useTelegramLinkQuery } from '@/entities/notification'
import { useTelegramLink } from '../model/use-telegram-link'

const props = defineProps<{ tenantId: string; timeZone: string; quiet?: boolean | undefined }>()

const status = useTelegramLinkQuery(toRef(props, 'tenantId'))
const link = useTelegramLink(() => props.tenantId)
const confirmOpen = ref(false)

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
const error = computed(
  () => link.issue.error.value ?? link.check.error.value ?? link.disable.error.value,
)
const errorView = computed(() => (error.value ? describeError(error.value) : null))
const traceId = computed(() => (isApiError(error.value) ? error.value.traceId : ''))
const checkedNotLinked = computed(() => link.check.data.value === false)

async function disable(): Promise<void> {
  const ok = await link.disable
    .mutateAsync()
    .then(() => true)
    .catch(() => false)
  if (ok) confirmOpen.value = false
}
</script>

<template>
  <section aria-labelledby="telegram-link-title" class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="telegram-link-title" class="text-lg font-bold text-ink">
          Ваши уведомления в Telegram
        </h2>
        <p class="mt-1 text-sm text-muted">
          Личная привязка: бот сообщает о рисках и даёт ссылку на рабочий контекст. Подтверждение
          оплаты выполняется только в LidRadar.
        </p>
      </div>
      <UiSkeleton v-if="status.isPending.value" class="h-6 w-28" />
      <UiBadge v-else-if="!status.isError.value" :tone="linked ? 'success' : 'warning'">
        {{ linked ? 'Подключены' : 'Не подключены' }}
      </UiBadge>
    </div>

    <UiAlert v-if="status.isError.value" tone="danger" title="Не удалось прочитать статус привязки">
      Повторите попытку позже: настройки уведомлений при этом сохраняются.
    </UiAlert>

    <template v-else-if="!status.isPending.value">
      <div v-if="linked" class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-ink">
          Привязка активна<template v-if="status.data.value?.linkedAt">
            с {{ formatDateTime(status.data.value.linkedAt, timeZone) }}</template
          >.
        </p>
        <UiButton variant="secondary" size="sm" @click="confirmOpen = true">Отключить</UiButton>
      </div>

      <div v-else class="flex flex-col gap-3">
        <template v-if="activeToken">
          <p class="text-sm text-ink">
            Откройте бота по одноразовой ссылке и нажмите «Начать». Вернитесь сюда — состояние
            обновится после привязки.
          </p>
          <UiAlert v-if="!startUrl" tone="danger" title="Ссылка привязки непригодна">
            Сервер вернул адрес с неожиданной схемой, он не будет открыт. Выпустите новую ссылку.
          </UiAlert>
          <div class="flex flex-wrap items-center gap-3">
            <a
              v-if="startUrl"
              :href="startUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-11 items-center rounded-control bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Открыть бота
            </a>
            <UiButton
              variant="secondary"
              :loading="link.check.isPending.value"
              @click="link.check.mutate()"
            >
              Проверить привязку
            </UiButton>
            <span class="text-xs text-muted">
              Ссылка действует до {{ formatDateTime(activeToken.expiresAt, timeZone) }} ({{
                formatRelative(activeToken.expiresAt)
              }})
            </span>
          </div>
          <p v-if="checkedNotLinked" class="text-sm text-muted" role="status">
            Привязка ещё не завершена: откройте бота и нажмите «Начать», затем проверьте снова.
          </p>
          <p v-else-if="link.pollsExhausted.value" class="text-sm text-muted" role="status">
            Автоматическая проверка остановлена — нажмите «Проверить привязку» после подтверждения в
            боте.
          </p>
        </template>
        <template v-else>
          <p v-if="link.expired.value" class="text-sm text-muted" role="status">
            Срок ссылки истёк. Выпустите новую — прежняя больше не сработает.
          </p>
          <div>
            <UiButton
              :variant="quiet ? 'secondary' : 'primary'"
              :loading="link.issue.isPending.value"
              @click="link.issue.mutate()"
            >
              {{ link.expired.value ? 'Выпустить новую ссылку' : 'Подключить уведомления' }}
            </UiButton>
          </div>
        </template>
      </div>
    </template>

    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
    </UiAlert>

    <UiDialog
      v-model:open="confirmOpen"
      title="Отключить личные уведомления?"
      description="Бот перестанет присылать вам сообщения о рисках. Источник переписки организации это не затрагивает."
      :dismissible="!link.disable.isPending.value"
    >
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="link.disable.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton variant="danger" :loading="link.disable.isPending.value" @click="disable">
          Отключить
        </UiButton>
      </template>
    </UiDialog>
  </section>
</template>
