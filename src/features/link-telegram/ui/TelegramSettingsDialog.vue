<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { describeError } from '@/shared/api'
import { UiAlert, UiButton, UiSheetDialog } from '@/shared/ui'
import { isSafeStartUrl, useTelegramLinkQuery } from '@/entities/notification'
import { useTelegramLink } from '../model/use-telegram-link'
const props = defineProps<{ tenantId: string; timeZone: string; disconnect?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const status = useTelegramLinkQuery(() => props.tenantId)
const link = useTelegramLink(() => props.tenantId)
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 60_000)
onScopeDispose(() => clearInterval(clock))
const busy = computed(
  () => link.issue.isPending.value || link.check.isPending.value || link.disable.isPending.value,
)
const error = computed(
  () => link.issue.error.value ?? link.check.error.value ?? link.disable.error.value,
)
const view = computed(() => (error.value ? describeError(error.value) : null))
const token = computed(() => (link.token.value && !link.expired.value ? link.token.value : null))
const url = computed(() =>
  token.value && isSafeStartUrl(token.value.startUrl) ? token.value.startUrl : null,
)
const expires = computed(() => {
  if (!token.value) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: props.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(token.value.expiresAt))
})
const minutes = computed(() =>
  token.value
    ? Math.max(0, Math.ceil((Date.parse(token.value.expiresAt) - now.value) / 60_000))
    : 0,
)
if (!props.disconnect) link.issue.mutate()
watch(
  () => status.data.value?.linked,
  (value) => {
    if (value && !props.disconnect) emit('close')
  },
)
async function confirmDisconnect() {
  const tenant = props.tenantId
  try {
    await link.disable.mutateAsync()
    if (tenant === props.tenantId) emit('close')
  } catch {
    /* inline feedback */
  }
}
</script>
<template>
  <UiSheetDialog
    :open="true"
    :title="disconnect ? 'Отключить Telegram?' : 'Личные уведомления в Telegram'"
    settings-redesign
    footer-fill
    size="sm"
    :content-height="600"
    :dismissible="!busy"
    @update:open="!$event && emit('close')"
  >
    <div class="flex flex-col gap-4 text-sm leading-5 text-ink">
      <p v-if="disconnect">
        Бот перестанет присылать вам сообщения о рисках. Источник переписки организации это не
        затрагивает.
      </p>
      <template v-else>
        <p class="font-medium text-muted">Личная привязка · Не источник переписки</p>
        <p>Бот сообщает о рисках по вашим правилам. Подтверждение оплаты выполняется в LidRadar.</p>
        <h3 v-if="link.issue.isPending.value" class="text-xl leading-7 font-semibold">
          Готовим одноразовую ссылку…
        </h3>
        <UiAlert v-else-if="link.expired.value" compact tone="danger" title="Срок ссылки истёк"
          >Получите новую ссылку. Предыдущая больше не работает.</UiAlert
        >
        <UiAlert
          v-else-if="view"
          compact
          tone="danger"
          :title="link.check.error.value ? 'Не удалось проверить Telegram' : view.title"
          >{{
            link.check.error.value
              ? 'Повторите проверку. Настройки правил сохранятся.'
              : view.description
          }}</UiAlert
        >
        <template v-else-if="token">
          <ol class="list-inside list-decimal">
            <li>Откройте бота по одноразовой ссылке.</li>
            <li>Нажмите «Начать» в Telegram.</li>
            <li>Вернитесь и проверьте привязку.</li>
          </ol>
          <p class="font-medium text-muted">
            Ссылка действует до {{ expires }} (ещё {{ minutes }} мин).
          </p>
          <UiAlert v-if="!url" compact tone="danger" title="Ссылка привязки непригодна"
            >Выпустите новую ссылку. Адрес с неожиданной схемой не будет открыт.</UiAlert
          >
          <p v-else class="text-muted" role="status">
            {{
              link.check.isPending.value
                ? 'Проверяем привязку…'
                : 'Привязка ещё не завершена. После нажатия «Начать» нажмите «Проверить привязку».'
            }}
          </p>
          <p v-if="link.pollsExhausted.value" class="text-muted">
            Автоматическая проверка остановлена. Проверьте привязку вручную.
          </p>
        </template>
      </template>
      <UiAlert v-if="disconnect && view" compact tone="danger" :title="view.title">{{
        view.description
      }}</UiAlert>
    </div>
    <template #footer>
      <template v-if="disconnect">
        <UiButton variant="secondary" :disabled="busy" @click="emit('close')">Отмена</UiButton>
        <UiButton
          variant="secondary"
          style="color: var(--color-danger)"
          :loading="busy"
          @click="confirmDisconnect"
          >Отключить</UiButton
        >
      </template>
      <template v-else-if="token && url && !view">
        <UiButton
          variant="secondary"
          :disabled="busy"
          class="disabled:bg-line disabled:text-muted disabled:opacity-100"
          @click="link.check.mutate()"
          >{{ link.check.isPending.value ? 'Проверяем…' : 'Проверить привязку' }}</UiButton
        >
        <a
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex h-input items-center justify-center rounded-button bg-brand px-6 text-field font-medium text-white"
          >Открыть бота</a
        >
      </template>
      <template v-else>
        <UiButton variant="secondary" :disabled="busy" @click="emit('close')">Закрыть</UiButton>
        <UiButton
          :loading="link.issue.isPending.value || link.check.isPending.value"
          @click="link.check.error.value ? link.check.mutate() : link.issue.mutate()"
          >{{
            link.issue.isPending.value
              ? 'Готовим ссылку…'
              : link.expired.value
                ? 'Выпустить новую ссылку'
                : link.check.error.value
                  ? 'Повторить проверку'
                  : 'Повторить'
          }}</UiButton
        >
      </template>
    </template>
  </UiSheetDialog>
</template>
