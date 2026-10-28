<script setup lang="ts">
/**
 * Недействительная ссылка сброса пароля (Figma «Ссылка восстановления», 462:5880 и состояния).
 * Сервер не отличает просроченную ссылку от использованной или отозванной (`RESET_TOKEN_INVALID`),
 * поэтому формулировка общая; `rejected` (ответ сервера) окрашивает надпись и рамку карточки в красный.
 * `loading` — первичная загрузка: «Проверяем ссылку…» и недоступная кнопка.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiButton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { AuthCardHeader } from '@/features/auth-session'

defineProps<{ rejected?: boolean; loading?: boolean }>()

const router = useRouter()
const session = useSessionStore()
/** Переход к форме запроса идёт, пока подгружается её код: кнопка занята («Открываем форму…»). */
const opening = ref(false)

async function requestNewLink(): Promise<void> {
  if (opening.value) return
  opening.value = true
  try {
    await router.push({ name: 'forgot-password' })
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <template v-if="loading">
    <AuthCardHeader
      eyebrow="Восстановление доступа"
      title="Проверяем ссылку…"
      description="Загружаем форму восстановления…"
    />
    <!-- Каркас кнопки: недоступна и скринридеру не объявляется (статус — «Загрузка» ниже). -->
    <div
      class="flex h-[46px] items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted"
      aria-hidden="true"
    >
      Запросить новую ссылку
    </div>
    <p class="sr-only" role="status">Загрузка</p>
  </template>
  <template v-else>
    <AuthCardHeader
      data-testid="reset-link-invalid"
      eyebrow="Восстановление доступа"
      title="Ссылка недействительна"
      :description="
        session.isAuthenticated
          ? 'Ссылка устарела, уже использована или скопирована не полностью.'
          : 'Ссылка устарела, уже использована или скопирована не полностью. Запросите новое письмо: новая ссылка отменяет прежние.'
      "
      :danger="rejected"
    />
    <!-- Запрос письма доступен только гостю (ADR 0058): вошедшему — смена пароля в настройках. -->
    <template v-if="session.isAuthenticated">
      <p class="text-sm text-secondary" data-testid="reset-link-signed-in">
        Вы уже вошли в аккаунт. Пароль можно сменить в разделе «Настройки → Аккаунт».
      </p>
      <UiButton block @click="router.push({ name: 'radar' })">Продолжить работу</UiButton>
    </template>
    <UiButton v-else block :loading="opening" @click="requestNewLink">
      <template v-if="opening">
        <span aria-hidden="true">Открываем форму…</span
        ><span class="sr-only">Запросить новую ссылку</span>
      </template>
      <template v-else>Запросить новую ссылку</template>
    </UiButton>
  </template>
</template>
