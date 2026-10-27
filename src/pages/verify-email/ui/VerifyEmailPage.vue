<script setup lang="ts">
/**
 * Подтверждение почты по ссылке из письма (ADR 0058). Подтверждение мягкое: страница ничего не
 * блокирует. Токен берётся из фрагмента адреса и сразу убирается из него; открыть ссылку можно в
 * любом браузере, поэтому сессия не нужна. Если сессия есть, после успеха она перечитывается, чтобы
 * напоминание о неподтверждённой почте исчезло.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { describeError, isApiError } from '@/shared/api'
import { readFragmentToken } from '@/shared/lib'
import { UiAlert, UiButton, UiCard, UiSpinner } from '@/shared/ui'
import { useSessionStore, verifyEmail } from '@/entities/session'
import { ResendVerificationButton } from '@/features/auth-session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const token = readFragmentToken(route.hash)
if (route.hash !== '') {
  void router.replace({ path: route.path, query: route.query, hash: '' })
}

type State = 'loading' | 'done' | 'invalid' | 'error'
const state = ref<State>(token === null ? 'invalid' : 'loading')
const failure = ref<unknown>(null)

async function confirm(): Promise<void> {
  if (token === null) return
  state.value = 'loading'
  failure.value = null
  try {
    await verifyEmail({ token })
    state.value = 'done'
    if (session.isAuthenticated) {
      // Не критично: баннер исчезнет и при следующем обновлении сессии.
      await session.refresh().catch(() => undefined)
    }
  } catch (error) {
    if (isApiError(error) && error.code === 'VERIFICATION_TOKEN_INVALID') {
      state.value = 'invalid'
      return
    }
    failure.value = error
    state.value = 'error'
  }
}

onMounted(() => void confirm())

function proceed(): void {
  void router.replace(session.isAuthenticated ? { name: 'radar' } : { name: 'login' })
}
</script>

<template>
  <div>
    <UiCard :padded="false" class="p-[23px] md:p-[31px]">
      <p class="text-xs font-semibold tracking-wide text-muted">Подтверждение почты</p>

      <template v-if="state === 'loading'">
        <h1 class="mt-2 text-2xl font-bold text-ink">Подтверждаем адрес…</h1>
        <p class="mt-4 flex items-center gap-3 text-sm text-muted" role="status">
          <UiSpinner class="size-5" />Это займёт несколько секунд.
        </p>
      </template>

      <template v-else-if="state === 'done'">
        <h1 class="mt-2 text-2xl font-bold text-ink">Почта подтверждена</h1>
        <p class="mt-2 text-sm text-muted" data-testid="verify-done">
          Спасибо. Теперь мы знаем, что письма о безопасности аккаунта дойдут до вас.
        </p>
        <div class="mt-6">
          <UiButton block @click="proceed">
            {{ session.isAuthenticated ? 'Продолжить работу' : 'Войти' }}
          </UiButton>
        </div>
      </template>

      <template v-else-if="state === 'invalid'">
        <h1 class="mt-2 text-2xl font-bold text-ink">Ссылка недействительна</h1>
        <p class="mt-2 text-sm text-muted" data-testid="verify-invalid">
          Ссылка устарела, уже использована или скопирована не полностью.
        </p>
        <div class="mt-6 flex flex-col gap-3">
          <template v-if="session.isAuthenticated">
            <p v-if="!session.emailUnverified" class="text-sm text-ink">
              Ваш адрес уже подтверждён: ничего делать не нужно.
            </p>
            <ResendVerificationButton v-else variant="primary" />
            <UiButton variant="secondary" @click="proceed">Продолжить работу</UiButton>
          </template>
          <p v-else class="text-sm text-muted">
            Войдите и запросите новое письмо в разделе «Настройки → Аккаунт».
          </p>
          <UiButton v-if="!session.isAuthenticated" variant="secondary" @click="proceed"
            >Войти</UiButton
          >
        </div>
      </template>

      <template v-else>
        <h1 class="mt-2 text-2xl font-bold text-ink">Не удалось подтвердить</h1>
        <div class="mt-4">
          <UiAlert tone="danger" :title="describeError(failure).title">
            {{ describeError(failure).description }}
          </UiAlert>
        </div>
        <div class="mt-6">
          <UiButton block @click="confirm">Повторить</UiButton>
        </div>
      </template>
    </UiCard>
  </div>
</template>
