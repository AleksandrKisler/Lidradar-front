<script setup lang="ts">
/**
 * Корень приложения. До завершения первичной загрузки сессии показывается
 * нейтральный экран: ни вход, ни данные прошлой организации не мелькают.
 * Ошибка сети или сервера на старте не считается выходом из системы —
 * предлагается повтор, после которого выполняется исходный переход.
 */
import { defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiErrorState, UiSpinner } from '@/shared/ui'
// Каркас входа нужен только при первой загрузке на /login: остаётся отдельными чанками.
const LoginPage = defineAsyncComponent(() => import('@/pages/login').then((m) => m.LoginPage))
const RegisterPage = defineAsyncComponent(() =>
  import('@/pages/register').then((m) => m.RegisterPage),
)
const ForgotPasswordPage = defineAsyncComponent(() =>
  import('@/pages/forgot-password').then((m) => m.ForgotPasswordPage),
)
const ResetPasswordPage = defineAsyncComponent(() =>
  import('@/pages/reset-password').then((m) => m.ResetPasswordPage),
)
const VerifyEmailPage = defineAsyncComponent(() =>
  import('@/pages/verify-email').then((m) => m.VerifyEmailPage),
)
const WorkspacesPage = defineAsyncComponent(() =>
  import('@/pages/workspaces').then((m) => m.WorkspacesPage),
)
const AcceptInvitationPage = defineAsyncComponent(() =>
  import('@/pages/invitations').then((m) => m.AcceptInvitationPage),
)
const AuthLayout = defineAsyncComponent(() => import('./layouts/AuthLayout.vue'))
const PlainLayout = defineAsyncComponent(() => import('./layouts/PlainLayout.vue'))
import { useSessionStore } from '@/entities/session'

const session = useSessionStore()
const router = useRouter()

/** Адрес, который пользователь открыл до ошибки загрузки. */
const initialTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`
const retrying = ref(false)
/** Первая загрузка на гостевом адресе Access показывает каркас страницы, а не нейтральный экран. */
const skeletonPages = {
  '/login': LoginPage,
  '/register': RegisterPage,
  '/forgot-password': ForgotPasswordPage,
  '/reset-password': ResetPasswordPage,
  '/verify-email': VerifyEmailPage,
} as const
const skeletonPage = skeletonPages[window.location.pathname as keyof typeof skeletonPages] ?? null
/** Страницы без боковой панели: при первой загрузке — шапка с брендом и каркас страницы. */
const plainSkeletonPages = {
  '/workspaces': WorkspacesPage,
  '/invitations/accept': AcceptInvitationPage,
} as const
const plainSkeletonPage =
  plainSkeletonPages[window.location.pathname as keyof typeof plainSkeletonPages] ?? null

async function retry(): Promise<void> {
  retrying.value = true
  try {
    await session.bootstrap()
    if (session.status !== 'error') await router.replace(initialTarget)
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <AuthLayout v-if="!session.booted && skeletonPage">
    <component :is="skeletonPage" loading />
  </AuthLayout>
  <PlainLayout v-else-if="!session.booted && plainSkeletonPage" loading>
    <component :is="plainSkeletonPage" loading />
  </PlainLayout>
  <div v-else-if="!session.booted" class="flex min-h-dvh items-center justify-center" role="status">
    <UiSpinner class="size-8 text-brand" label="Загрузка приложения" />
  </div>
  <div
    v-else-if="session.status === 'error'"
    class="flex min-h-dvh items-center justify-center p-6"
  >
    <div class="w-full max-w-lg">
      <UiErrorState
        :error="session.bootError"
        title="Не удалось загрузить приложение"
        :retry-label="retrying ? 'Повторяем…' : 'Повторить'"
        @retry="retry"
      />
    </div>
  </div>
  <RouterView v-else />
</template>
