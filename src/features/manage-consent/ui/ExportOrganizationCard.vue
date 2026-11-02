<script setup lang="ts">
/** ADR0059: one real streaming ZIP response, never a synthetic job/progress API. */
import { computed, ref } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { formatBytes, safeFilename, saveBlob } from '@/shared/lib'
import { UiAlert, UiButton, UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { exportOrganizationData } from '@/entities/organization'
import { usePrivacyContext } from '../model/use-privacy-context'

const props = defineProps<{ tenantId: string; desktop?: boolean }>()
const session = useSessionStore()
const busy = ref(false)
const saved = ref<{ name: string; size: number } | null>(null)
const failure = ref<unknown>(null)
const retryUntil = ref(0)
let timer: ReturnType<typeof setTimeout> | undefined
const context = usePrivacyContext(
  () => props.tenantId,
  'organization.export',
  () => {
    busy.value = false
    saved.value = null
    failure.value = null
    retryUntil.value = 0
    clearTimeout(timer)
  },
)
const failureView = computed(() => {
  const error = failure.value
  if (!error) return null
  if (isApiError(error) && error.isRateLimited) {
    const wait = error.retryAfterSeconds
    const occupied = error.code === 'EXPORT_BUSY'
    return {
      tone: 'warning' as const,
      title: occupied ? '! Сейчас нельзя начать выгрузку' : '! Лимит выгрузок достигнут',
      text: `${occupied ? 'Сервер занят подготовкой архива.' : 'Доступно 3 выгрузки в час.'} ${wait ? `Повторите ${new Intl.RelativeTimeFormat('ru-RU').format(Math.ceil(wait / (wait < 90 ? 1 : 60)), wait < 90 ? 'second' : 'minute')}.` : 'Повторите позже.'}`,
    }
  }
  return {
    tone: 'danger' as const,
    title: '! Не удалось получить архив',
    text:
      isApiError(error) && error.isForbidden
        ? describeError(error).description
        : 'Попробуйте скачать архив ещё раз.',
  }
})
async function download() {
  const captured = context.capture()
  if (!captured || busy.value || Date.now() < retryUntil.value) return
  busy.value = true
  saved.value = null
  failure.value = null
  try {
    const file = await exportOrganizationData(captured.tenantId)
    if (!context.current(captured)) return
    const name = safeFilename(file.filename, 'lidradar-organization.zip')
    saveBlob(file.blob, name)
    saved.value = { name, size: file.blob.size }
  } catch (error) {
    if (!context.current(captured)) return
    failure.value = error
    if (isApiError(error) && error.isRateLimited && error.retryAfterSeconds) {
      retryUntil.value = Date.now() + error.retryAfterSeconds * 1000
      clearTimeout(timer)
      timer = setTimeout(() => {
        retryUntil.value = 0
      }, error.retryAfterSeconds * 1000)
    }
    if (isApiError(error) && error.isForbidden) await session.refresh().catch(() => {})
  } finally {
    if (context.current(captured)) busy.value = false
  }
}
</script>

<template>
  <UiCard
    as="section"
    :padded="false"
    aria-labelledby="export-organization-title"
    class="flex flex-col gap-4 p-4 md:p-6"
  >
    <h2 id="export-organization-title" class="text-xl leading-7 font-semibold text-ink">
      Копия данных компании
    </h2>
    <p class="text-sm text-muted">Рабочие данные и настройки в одном ZIP-архиве.</p>
    <dl class="flex flex-col gap-3 text-sm leading-5 text-muted">
      <dt class="font-medium text-ink">В архиве</dt>
      <dd>
        Команда, точки, услуги, подключения, контакты и переписки; сделки, риски, выручка, согласия
        и журнал действий.
      </dd>
      <dt class="font-medium text-ink">Не входят</dt>
      <dd>Пароли и ключи доступа, служебные данные и личные данные участников.</dd>
    </dl>
    <div class="flex flex-wrap items-center gap-3">
      <UiButton
        variant="secondary"
        :loading="busy"
        :style="{
          width: desktop ? '210px' : '100%',
          transitionDuration: '0s',
          ...(busy || retryUntil > 0
            ? {
                backgroundColor: 'var(--color-line)',
                color: 'var(--color-muted)',
                opacity: busy ? 0.65 : 1,
              }
            : {}),
        }"
        :aria-disabled="retryUntil > 0 || undefined"
        data-testid="export-organization"
        @click="download"
        >{{ busy ? 'Готовим архив…' : 'Скачать архив ZIP' }}</UiButton
      >
      <p class="text-xs leading-[18px] text-muted">
        Не чаще 3 раз в час. Подготовка может занять несколько минут.
      </p>
    </div>
    <p v-if="busy" role="status" class="text-xs leading-[18px] text-muted">
      После подготовки браузер начнёт скачивание. Большой архив может готовиться несколько минут.
    </p>
    <UiAlert
      v-if="failureView"
      :tone="failureView.tone"
      compact
      privacy-page
      :title="failureView.title"
      :trace-id="isApiError(failure) ? failure.traceId : ''"
      data-testid="export-organization-error"
      >{{ failureView.text }}</UiAlert
    >
    <UiAlert
      v-if="saved"
      tone="success"
      compact
      privacy-page
      title="✓ Архив готов"
      data-testid="export-organization-saved"
    >
      <p class="break-words">{{ saved.name }} · {{ formatBytes(saved.size) }}</p>
      <p>Файл передан браузеру для скачивания.</p>
    </UiAlert>
  </UiCard>
</template>
