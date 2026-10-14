<script setup lang="ts">
/**
 * Выгрузка данных организации (ADR 0059), право только у владельца. Архив собирается на сервере потоком
 * и приходит файлом: команда, точки, услуги, каналы без ключей доступа, переписки, сделки, риски, выручка
 * и журнал действий. Ключи, служебные очереди и личные данные участников в архив не входят. Выгрузок не
 * больше трёх в час на организацию; пока идёт другая, сервер просит повторить позже.
 */
import { computed, ref } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { formatBytes, formatWait, safeFilename, saveBlob } from '@/shared/lib'
import { UiAlert, UiButton, UiCard } from '@/shared/ui'
import { exportOrganizationData } from '@/entities/organization'

const props = defineProps<{ tenantId: string }>()

const busy = ref(false)
const saved = ref<{ name: string; size: number } | null>(null)
const failure = ref<unknown>(null)

const failureView = computed(() => {
  const error = failure.value
  if (error === null) return null
  // EXPORT_BUSY тоже приходит со статусом 429: срок повтора из Retry-After показывается так же, как у предела.
  if (isApiError(error) && error.isRateLimited) {
    const wait = error.retryAfterSeconds
    const base = describeError(error)
    return {
      tone: 'warning' as const,
      title: base.title,
      text: wait ? `Повторите через ${formatWait(wait)}.` : base.description,
    }
  }
  const described = describeError(error)
  return { tone: 'danger' as const, title: described.title, text: described.description }
})

async function download(): Promise<void> {
  if (busy.value) return
  busy.value = true
  saved.value = null
  failure.value = null
  try {
    const file = await exportOrganizationData(props.tenantId)
    const name = safeFilename(file.filename, 'lidradar-organization.zip')
    saveBlob(file.blob, name)
    saved.value = { name, size: file.blob.size }
  } catch (error) {
    failure.value = error
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UiCard as="section" aria-labelledby="export-organization-title">
    <h2 id="export-organization-title" class="text-lg font-bold text-ink">
      Выгрузка данных организации
    </h2>
    <p class="mt-1 text-sm text-muted">
      Архив ZIP со всеми данными организации: файлы JSON Lines по разделам, описание состава и
      контрольные суммы.
    </p>
    <ul class="mt-4 flex flex-col gap-2 text-sm text-ink">
      <li>
        В архиве: команда, точки и часы работы, услуги, каналы без ключей доступа, контакты,
        переписки и сообщения, сводки, сделки, риски, вердикты, действия, исходы, выручка, согласия
        и журнал действий организации.
      </li>
      <li>
        Не входят: ключи и секреты, служебные очереди, личные данные участников — каждый скачивает
        их в разделе «Аккаунт».
      </li>
      <li>Не чаще трёх раз в час. Подготовка большого архива может занять несколько минут.</li>
    </ul>
    <div class="mt-5">
      <UiButton
        variant="secondary"
        :loading="busy"
        data-testid="export-organization"
        @click="download"
      >
        {{ busy ? 'Готовим архив…' : 'Скачать архив' }}
      </UiButton>
    </div>
    <UiAlert
      v-if="failureView"
      class="mt-4"
      :tone="failureView.tone"
      :title="failureView.title"
      :trace-id="isApiError(failure) ? failure.traceId : ''"
      data-testid="export-organization-error"
    >
      {{ failureView.text }}
    </UiAlert>
    <UiAlert
      v-if="saved"
      class="mt-4"
      tone="success"
      title="Архив сохранён"
      data-testid="export-organization-saved"
    >
      {{ saved.name }} ({{ formatBytes(saved.size) }}). Файл manifest.json в конце архива
      подтверждает, что выгрузка полная.
    </UiAlert>
  </UiCard>
</template>
