<script setup lang="ts">
/**
 * Подтверждение почты по ссылке из письма (ADR 0058) по макету Access «Подтверждение почты»
 * (Figma 462:5966 и состояния). Подтверждение мягкое: страница ничего не блокирует. Токен берётся из
 * фрагмента адреса и сразу убирается из него; открыть ссылку можно в любом браузере, поэтому сессия не
 * нужна. Если сессия есть, после успеха она перечитывается, чтобы напоминание о неподтверждённой почте
 * исчезло.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { describeError, isApiError } from '@/shared/api'
import { readFragmentToken } from '@/shared/lib'
import { UiAlert, UiButton, UiCard, UiSpinner } from '@/shared/ui'
import { useSessionStore, verifyEmail } from '@/entities/session'
import { AuthCardHeader, ResendVerificationButton } from '@/features/auth-session'

const props = defineProps<{
  /** Первичная загрузка сессии: каркас страницы без запроса подтверждения. */
  loading?: boolean
}>()

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

// При первой загрузке маршрут ещё не разобран: токен берётся из адреса окна и из адреса не убирается.
const token = readFragmentToken(props.loading ? window.location.hash : route.hash)
if (!props.loading && route.hash !== '') {
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

onMounted(() => {
  if (!props.loading) void confirm()
})

/** Нет связи с сервером: подпись макета «Нет соединения» (Figma 462:7724); прочие ошибки — общие. */
function failureView(): { title: string; description: string } {
  const error = failure.value
  if (isApiError(error) && error.httpStatus === 0) {
    return {
      title: 'Нет соединения',
      description: 'Не удалось связаться с сервером. Проверьте подключение.',
    }
  }
  return describeError(error)
}

function proceed(): void {
  void router.replace(session.isAuthenticated ? { name: 'radar' } : { name: 'login' })
}
</script>

<template>
  <UiCard :padded="false" class="flex flex-col gap-6 p-[23px] md:p-[31px]">
    <!-- Первичная загрузка сессии (Figma «Первичная загрузка») -->
    <template v-if="loading">
      <AuthCardHeader
        eyebrow="Подтверждение почты"
        title="Подтверждаем почту…"
        description="Проверяем ссылку подтверждения."
      >
        <p class="mt-4 text-sm text-secondary" role="status">
          Результат появится здесь автоматически.
        </p>
      </AuthCardHeader>
      <!-- Каркас: кнопка недоступна, пока страница не загрузилась (Figma «Первичная загрузка»). -->
      <div
        class="-mt-2 flex h-[46px] items-center justify-center rounded-button border border-line bg-paper text-field leading-5 font-medium text-muted"
      >
        Вернуться ко входу
      </div>
    </template>

    <!-- Запрос подтверждения идёт (Figma «Отправка») -->
    <template v-else-if="state === 'loading'">
      <AuthCardHeader eyebrow="Подтверждение почты" title="Подтверждаем почту…" />
      <p class="flex items-center gap-3 text-sm text-secondary" role="status">
        <UiSpinner class="size-4 text-brand" />Проверка выполняется…
      </p>
    </template>

    <template v-else-if="state === 'done'">
      <AuthCardHeader
        data-testid="verify-done"
        eyebrow="Подтверждение почты"
        title="Почта подтверждена"
        description="Спасибо. Теперь мы знаем, что письма о безопасности аккаунта дойдут до вас."
      />
      <UiButton block @click="proceed">
        {{ session.isAuthenticated ? 'Продолжить работу' : 'Войти' }}
      </UiButton>
    </template>

    <template v-else-if="state === 'invalid'">
      <AuthCardHeader
        data-testid="verify-invalid"
        eyebrow="Подтверждение почты"
        title="Ссылка недействительна"
        description="Ссылка устарела, уже использована или скопирована не полностью."
      >
        <p v-if="!session.isAuthenticated" class="mt-4 text-sm text-secondary">
          Войдите и запросите новое письмо в разделе «Настройки → Аккаунт».
        </p>
        <p
          v-else-if="!session.emailUnverified"
          class="mt-4 text-sm text-ink"
          data-testid="verify-already"
        >
          Ваш адрес уже подтверждён: ничего делать не нужно.
        </p>
      </AuthCardHeader>
      <div class="-mt-2 flex flex-col gap-3">
        <template v-if="session.isAuthenticated">
          <ResendVerificationButton v-if="session.emailUnverified" variant="primary" />
          <UiButton :variant="session.emailUnverified ? 'secondary' : 'primary'" @click="proceed">
            Продолжить работу
          </UiButton>
        </template>
        <UiButton v-else @click="proceed">Войти</UiButton>
      </div>
    </template>

    <template v-else>
      <AuthCardHeader eyebrow="Подтверждение почты" title="Подтверждение почты" />
      <div class="flex flex-col gap-4">
        <UiAlert tone="danger" :title="failureView().title">
          {{ failureView().description }}
        </UiAlert>
        <UiButton block @click="confirm">Повторить проверку</UiButton>
      </div>
    </template>
  </UiCard>
</template>
