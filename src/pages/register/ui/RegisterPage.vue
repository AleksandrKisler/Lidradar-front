<script setup lang="ts">
/**
 * Регистрация US-M01-01 на одном маршруте `/register` (Figma 691:3945 и сетки 461:5460/5475/5490):
 * A — открытая регистрация, B2 — код приглашения, B3 — данные после проверенного кода,
 * C — общая регистрация закрыта (warning над карточкой). Переходы, проверка кода, контекст
 * приглашения и результат отправки — в `useRegistrationFlow`; форма данных общая для A/B3/C.
 *
 * `loading` — каркас до первичной загрузки сессии (`App.vue`). В этом режиме модель не создаётся:
 * нет запросов режима или кода, контекст вкладки не читается и не пишется, адрес не меняется.
 * Вид каркаса выбирается только по текущему адресу.
 */
import { computed, onMounted, ref } from 'vue'
import { UiAlert, UiCard, UiErrorState } from '@/shared/ui'
import {
  InvitationCodeForm,
  RegisterForm,
  useRegistrationFlow,
  type RegistrationView,
} from '@/features/auth-session'

const props = defineProps<{
  /** Первичная загрузка сессии: каркас без динамики и без побочных действий. */
  loading?: boolean
}>()

const flow = props.loading ? null : useRegistrationFlow()

/** Каркас до загрузки сессии: B2 для приглашения или ссылки с кодом, иначе общий каркас A/C. */
function initialSkeleton(): RegistrationView {
  const query = new URLSearchParams(window.location.search)
  return query.get('flow') === 'invite' || query.has('code') ? 'invite-code' : 'mode-loading'
}
const skeletonView = props.loading ? initialSkeleton() : null

const view = computed<RegistrationView>(() => flow?.view.value ?? skeletonView ?? 'mode-loading')
/** Каркас начальной загрузки или ожидание ответа: подписи на месте, данных нет. */
const skeleton = computed(
  () => props.loading || view.value === 'mode-loading' || view.value === 'invite-restoring',
)
const isCodeStep = computed(() => view.value === 'invite-code')
const busy = computed(() => flow?.submitBusy.value ?? false)

const title = computed(() => (isCodeStep.value ? 'Регистрация по приглашению' : 'Создать аккаунт'))

/** Ссылка к шагу приглашения: в A/C и при сбое режима — переход на B2, в B3 — сброс проверки. */
const switchLink = computed(() => {
  switch (view.value) {
    case 'open':
    case 'closed':
    case 'mode-error':
    case 'mode-loading':
      return 'Использовать код приглашения'
    case 'invite-details':
    case 'invite-restoring':
      return 'Использовать другое приглашение'
    default:
      return null
  }
})
const switchActive = computed(() => !skeleton.value && !busy.value && !flow?.submitLocked.value)

const formVariant = computed(() =>
  view.value === 'closed' ? 'closed' : view.value === 'open' ? 'open' : 'invite',
)

/** B2, появившийся переходом внутри страницы (а не при открытии), получает фокус в поле кода. */
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

/** Успешная проверка объявляется вспомогательным технологиям; фокус уходит в форму данных. */
const announcement = computed(() =>
  view.value === 'invite-details' && flow?.openedByCheck.value ? 'Приглашение проверено.' : '',
)
</script>

<template>
  <!-- Exact frames US-M01-02 861:4730/5164: neutral-error card is 28 px above the usual desktop centre. -->
  <div
    class="flex flex-col gap-6"
    :class="flow?.submitStatus.value === 'rejected' ? 'lg:-translate-y-7' : ''"
  >
    <UiAlert v-if="view === 'closed'" tone="warning" icon="error" title="Регистрация закрыта">
      Доступ только по приглашению.
    </UiAlert>
    <UiCard :padded="false" class="flex flex-col gap-6 p-[23px] md:p-[31px]">
      <div class="flex flex-col gap-2">
        <p class="text-meta font-medium text-secondary">Новый аккаунт</p>
        <h1 class="text-metric font-semibold text-ink md:text-4xl md:leading-10">{{ title }}</h1>
        <p v-if="skeleton && !isCodeStep" class="text-note text-secondary">
          Загружаем форму регистрации…
        </p>
        <p v-else-if="isCodeStep" class="text-note text-secondary">
          Вставьте код приглашения. Мы проверим его автоматически, и вы сможете создать аккаунт.
        </p>
        <p v-else-if="view === 'open'" class="text-note text-secondary">
          Заполните имя, электронную почту и пароль, <br class="hidden md:inline" />чтобы создать
          аккаунт.
        </p>
        <p v-else-if="view === 'invite-details'" class="text-note text-secondary">
          Приглашение проверено. Заполните данные для создания аккаунта.
        </p>
        <div v-if="switchLink" class="flex h-[46px] items-center">
          <template v-if="!switchActive">
            <span class="text-sm text-link opacity-45">{{ switchLink }}</span>
          </template>
          <button
            v-else-if="view === 'invite-details'"
            type="button"
            class="text-left text-sm text-link hover:underline"
            @click="flow?.useOtherInvitation()"
          >
            {{ switchLink }}
          </button>
          <RouterLink
            v-else-if="flow"
            :to="flow.inviteLocation.value"
            class="text-sm text-link hover:underline"
            >{{ switchLink }}</RouterLink
          >
        </div>
      </div>

      <InvitationCodeForm
        v-if="isCodeStep"
        :loading="props.loading"
        :value="flow?.code.value ?? ''"
        :status="flow?.codeStatus.value ?? 'idle'"
        :retry-seconds="flow?.codeRetrySeconds.value ?? 0"
        :autofocus="mounted"
        @code-input="(value, composing) => flow?.inputCode(value, composing)"
        @check="flow?.submitCode()"
      />
      <UiErrorState
        v-else-if="view === 'mode-error' && flow"
        :error="flow.modeError.value"
        title="Не удалось загрузить форму регистрации"
        @retry="flow.retryMode()"
      />
      <RegisterForm
        v-else
        :key="skeleton ? 'skeleton' : view"
        :loading="skeleton"
        :variant="formVariant"
        :draft="flow?.draft"
        :status="flow?.submitStatus.value ?? 'idle'"
        :error="flow?.submitError.value ?? null"
        :retry-seconds="flow?.registerRetrySeconds.value ?? 0"
        :autofocus="flow?.openedByCheck.value ?? false"
        @update:draft="(next) => flow && Object.assign(flow.draft, next)"
        @edit="flow?.onDraftEdited()"
        @submit="(values) => flow?.submit(values)"
        @retry-session="flow?.retrySession()"
      />

      <p class="flex h-[46px] items-center justify-center text-center text-sm text-secondary">
        <span
          >Уже есть аккаунт?
          <RouterLink :to="{ name: 'login' }" class="font-medium text-link hover:underline"
            >Войти</RouterLink
          ></span
        >
      </p>
    </UiCard>
    <p class="sr-only" role="status">{{ announcement }}</p>
  </div>
</template>
