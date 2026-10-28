<script setup lang="ts">
/**
 * Новый пароль по ссылке из письма (ADR 0058) по макетам Access «Новый пароль» (Figma 462:5767) и
 * «Ссылка восстановления» (462:5880). Токен лежит во фрагменте адреса (`/reset-password#token=…`):
 * страница читает его один раз и сразу убирает из адреса, чтобы он не остался в истории браузера. Токен
 * живёт только в памяти страницы. Недействительную ссылку (нет токена, неверный формат, ответ сервера)
 * страница объясняет и предлагает запросить новое письмо. После успеха сервер завершил все сессии
 * пользователя: страница ведёт на вход с пометкой.
 */
import { ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { readFragmentToken } from '@/shared/lib'
import { UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { AuthCardHeader, ResetPasswordForm } from '@/features/auth-session'
import ResetLinkInvalid from './ResetLinkInvalid.vue'

const props = defineProps<{
  /** Первичная загрузка сессии: каркас страницы; адрес и маршрут ещё не разобраны. */
  loading?: boolean
}>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const queryClient = useQueryClient()

// При первой загрузке маршрут ещё не разобран: токен берётся из адреса окна и из адреса не убирается.
const token = readFragmentToken(props.loading ? window.location.hash : route.hash)
if (!props.loading && route.hash !== '') {
  void router.replace({ path: route.path, query: route.query, hash: '' })
}
/** Ссылка непригодна: нет токена или формат неверен (до запроса). */
const invalid = ref(token === null)
/** Ссылку не принял сервер (просрочена, использована или отозвана). */
const rejected = ref(false)

async function onDone(): Promise<void> {
  // Сервер завершил все сессии пользователя, чей токен использован. Сессию в этой вкладке спрашиваем у
  // сервера: если она тоже завершена (401), локальное состояние и кэш очищаются, и вход открывается с
  // «Пароль изменён». Если жива (ссылка пришла на другой аккаунт), она остаётся нетронутой. Без ответа
  // сервера (сеть) завершение считается состоявшимся: сервер завершает сессии до ответа на сброс.
  if (session.isAuthenticated) {
    try {
      await session.refresh()
    } catch {
      session.markSessionsEnded()
    }
    if (!session.isAuthenticated) queryClient.clear()
  }
  void router.replace({ name: 'login', query: { reset: 'done' } })
}
function onInvalid(): void {
  rejected.value = true
  invalid.value = true
}
</script>

<template>
  <UiCard
    :padded="false"
    :class="['flex flex-col gap-6 p-[23px] md:p-[31px]', rejected ? 'border-danger/25!' : '']"
  >
    <ResetLinkInvalid v-if="invalid || token === null" :rejected="rejected" :loading="loading" />
    <template v-else>
      <AuthCardHeader
        eyebrow="Восстановление доступа"
        title="Новый пароль"
        description="Все сеансы будут завершены. После смены войдите с новым паролем."
      />
      <ResetPasswordForm :token="token" :loading="loading" @done="onDone" @invalid="onInvalid" />
    </template>
    <p class="flex h-[46px] items-center justify-center text-center text-sm">
      <RouterLink :to="{ name: 'login' }" class="text-link hover:underline"
        >Вернуться ко входу</RouterLink
      >
    </p>
  </UiCard>
</template>
