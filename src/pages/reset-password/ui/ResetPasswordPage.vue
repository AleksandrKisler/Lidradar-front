<script setup lang="ts">
/**
 * Новый пароль по ссылке из письма (ADR 0058). Токен лежит во фрагменте адреса
 * (`/reset-password#token=…`): страница читает его один раз и сразу убирает из адреса, чтобы он не
 * остался в истории браузера. Токен живёт только в памяти страницы. Недействительную ссылку
 * (нет токена, неверный формат, ответ сервера) страница объясняет и предлагает запросить новое письмо.
 * После успеха сервер завершил все сессии пользователя: страница ведёт на вход с пометкой.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { readFragmentToken } from '@/shared/lib'
import { UiButton, UiCard } from '@/shared/ui'
import { ResetPasswordForm } from '@/features/auth-session'

const route = useRoute()
const router = useRouter()

const token = readFragmentToken(route.hash)
if (route.hash !== '') {
  void router.replace({ path: route.path, query: route.query, hash: '' })
}
const invalid = ref(token === null)

function onDone(): void {
  void router.replace({ name: 'login', query: { reset: 'done' } })
}
</script>

<template>
  <div>
    <UiCard class="shadow-sm">
      <template v-if="invalid || token === null">
        <p class="text-xs font-semibold tracking-wide text-muted">Восстановление доступа</p>
        <h1 class="mt-2 text-2xl font-bold text-ink">Ссылка недействительна</h1>
        <p class="mt-2 text-sm text-muted" data-testid="reset-link-invalid">
          Ссылка устарела, уже использована или скопирована не полностью. Запросите новое письмо:
          новая ссылка отменяет прежние.
        </p>
        <div class="mt-6">
          <UiButton block @click="router.push({ name: 'forgot-password' })">
            Запросить новую ссылку
          </UiButton>
        </div>
      </template>
      <template v-else>
        <p class="text-xs font-semibold tracking-wide text-muted">Восстановление доступа</p>
        <h1 class="mt-2 text-2xl font-bold text-ink">Придумайте новый пароль</h1>
        <p class="mt-2 text-sm text-muted">
          После смены вы выйдете со всех устройств и войдёте уже с новым паролем.
        </p>
        <div class="mt-6">
          <ResetPasswordForm :token="token" @done="onDone" @invalid="invalid = true" />
        </div>
      </template>
      <p class="mt-6 text-center text-sm text-muted">
        <RouterLink :to="{ name: 'login' }" class="font-semibold text-brand hover:underline"
          >Вернуться ко входу</RouterLink
        >
      </p>
    </UiCard>
  </div>
</template>
