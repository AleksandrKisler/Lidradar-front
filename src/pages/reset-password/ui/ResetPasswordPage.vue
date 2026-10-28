<script setup lang="ts">
/**
 * Новый пароль по ссылке из письма (ADR 0058) по макетам Access «Новый пароль» (Figma 462:5767) и
 * «Ссылка восстановления» (462:5880). Токен лежит во фрагменте адреса (`/reset-password#token=…`):
 * страница читает его один раз и сразу убирает из адреса, чтобы он не остался в истории браузера. Токен
 * живёт только в памяти страницы. Недействительную ссылку (нет токена, неверный формат, ответ сервера)
 * страница объясняет и предлагает запросить новое письмо. После успеха сервер завершил все сессии
 * пользователя: страница ведёт на вход с пометкой.
 */
import { nextTick, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRoute, useRouter } from 'vue-router'
import { readFragmentToken } from '@/shared/lib'
import { UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { UiButton, UiSpinner } from '@/shared/ui'
import { AuthCardHeader, LogoutButton, ResetPasswordForm } from '@/features/auth-session'
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

/**
 * Исход после подтверждённого сервером сброса (ответ `204`):
 * - гость — вход с «Пароль изменён»;
 * - `/auth/me` ответил `401` — сессия этой вкладки завершена сервером: локальная сессия и кэш очищаются,
 *   вход открывается с «Пароль изменён», в Radar не возвращает;
 * - `/auth/me` вернул действующую сессию (ссылка пришла на другой аккаунт) — сессия и кэш сохраняются,
 *   результат показывается здесь, без редиректа гостевого маршрута; выбор — остаться или выйти;
 * - перечитать сессию не удалось — подтверждённый успех сброса сохраняется, сессия завершается локально как
 *   защитное решение, и вход сообщает об этом отдельным текстом (отзыв сервером не утверждается).
 * Повторный сброс автоматически не отправляется ни в одном исходе.
 */
const finishing = ref(false)
const signedIn = ref(false)
const currentEmail = () => session.user?.email ?? ''

/** Карточка страницы: при смене состояния фокус переходит на её заголовок, и результат озвучивается. */
const card = ref<{ $el: HTMLElement } | null>(null)
async function focusHeading(): Promise<void> {
  await nextTick()
  card.value?.$el.querySelector<HTMLElement>('h1')?.focus()
}

async function onDone(): Promise<void> {
  finishing.value = true
  void focusHeading() // форма размонтирована: фокус не должен остаться на удалённой кнопке
  if (!session.isAuthenticated) {
    await router.replace({ name: 'login', query: { reset: 'done' } })
    return
  }
  const userBefore = session.user?.id ?? null
  let confirmedEnded = true
  try {
    await session.refresh()
  } catch {
    confirmedEnded = false
    session.markSessionsEnded()
  }
  if (session.isAuthenticated) {
    // В соседней вкладке мог войти другой пользователь: данные прежнего не должны остаться в кэше.
    if (session.user?.id !== userBefore) queryClient.clear()
    finishing.value = false
    signedIn.value = true
    void focusHeading()
    return
  }
  queryClient.clear()
  await router.replace({ name: 'login', query: { reset: confirmedEnded ? 'done' : 'local' } })
}

function continueWork(): void {
  void router.replace({ name: 'radar' })
}

function onLoggedOut(result: { confirmed: boolean }): void {
  void router.replace({
    name: 'login',
    query: result.confirmed ? {} : { signout: 'unconfirmed' },
  })
}
function onInvalid(): void {
  rejected.value = true
  invalid.value = true
}
</script>

<template>
  <UiCard
    ref="card"
    :padded="false"
    :class="['flex flex-col gap-6 p-[23px] md:p-[31px]', rejected ? 'border-danger/25!' : '']"
  >
    <!-- Сброс подтверждён, сессия этой вкладки жива: результат виден, автоматического выхода нет. -->
    <template v-if="signedIn">
      <AuthCardHeader
        data-testid="reset-done-signed-in"
        eyebrow="Восстановление доступа"
        title="Пароль изменён"
        :description="`Пароль по ссылке успешно изменён. В этом браузере вы вошли как ${currentEmail()}.`"
      />
      <div class="flex flex-col gap-3">
        <UiButton block @click="continueWork">Продолжить работу</UiButton>
        <LogoutButton
          variant="secondary"
          size="md"
          block
          class="h-auto! min-h-input py-2.5 whitespace-normal!"
          @logged-out="onLoggedOut"
          >Выйти и войти в другой аккаунт</LogoutButton
        >
      </div>
    </template>
    <template v-else-if="finishing">
      <AuthCardHeader
        eyebrow="Восстановление доступа"
        title="Пароль изменён"
        description="Проверяем состояние сессии в этом браузере…"
      />
      <p class="flex items-center gap-3 text-sm text-secondary" role="status">
        <UiSpinner class="size-4 text-brand" />Это займёт несколько секунд.
      </p>
    </template>
    <template v-else>
      <ResetLinkInvalid v-if="invalid || token === null" :rejected="rejected" :loading="loading" />
      <template v-else>
        <AuthCardHeader
          eyebrow="Восстановление доступа"
          title="Новый пароль"
          description="Сеансы восстанавливаемого аккаунта будут завершены. Для входа используйте новый пароль."
        />
        <ResetPasswordForm :token="token" :loading="loading" @done="onDone" @invalid="onInvalid" />
      </template>
      <p class="flex h-[46px] items-center justify-center text-center text-sm">
        <RouterLink :to="{ name: 'login' }" class="text-link hover:underline"
          >Вернуться ко входу</RouterLink
        >
      </p>
    </template>
  </UiCard>
</template>
