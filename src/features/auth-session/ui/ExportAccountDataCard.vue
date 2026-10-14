<script setup lang="ts">
/**
 * Личная выгрузка данных (ADR 0059): JSON-файл со всем, что LidRadar хранит об учётной записи. Файл содержит
 * адреса входов, поэтому скачивание требует пароль. Содержимое записей организации в файл не входит: его
 * выгружает владелец организации.
 */
import { ref } from 'vue'
import { safeFilename, saveBlob } from '@/shared/lib'
import { UiAlert, UiButton, UiCard } from '@/shared/ui'
import { exportAccountData } from '@/entities/session'
import PasswordConfirmDialog from './PasswordConfirmDialog.vue'

const open = ref(false)
const savedAs = ref<string | null>(null)

async function run(password: string): Promise<void> {
  savedAs.value = null
  const file = await exportAccountData({ password })
  const name = safeFilename(file.filename, 'lidradar-account.json')
  saveBlob(file.blob, name)
  savedAs.value = name
}
</script>

<template>
  <UiCard as="section" aria-labelledby="export-account-title">
    <h2 id="export-account-title" class="text-lg font-bold text-ink">Мои данные</h2>
    <p class="mt-1 text-sm text-muted">Скачайте всё, что LidRadar хранит о вашей учётной записи.</p>
    <ul class="mt-4 flex flex-col gap-2 text-sm text-ink">
      <li>
        В файле: профиль, ваши организации и роли, сессии и события входа с адресами, настройки
        уведомлений, привязка Telegram, решения по согласию на наборы данных и число записей,
        которые вы внесли.
      </li>
      <li>
        Не входят: пароль и его хэш, токены, а также содержимое записей организации — заметки,
        вердикты, переписки. Его выгружает владелец организации.
      </li>
    </ul>
    <div class="mt-5">
      <UiButton variant="secondary" data-testid="export-account-open" @click="open = true">
        Скачать мои данные…
      </UiButton>
    </div>
    <UiAlert
      v-if="savedAs"
      class="mt-4"
      tone="success"
      title="Файл сохранён"
      data-testid="export-account-saved"
    >
      {{ savedAs }}. В нём адреса и сведения о входах: храните файл как личный документ.
    </UiAlert>

    <PasswordConfirmDialog
      v-model:open="open"
      title="Скачать мои данные"
      description="Введите пароль: в файле адреса и сведения о входах."
      confirm-label="Скачать"
      retry-key="lidradar.account-export.retryUntil"
      :action="run"
    />
  </UiCard>
</template>
