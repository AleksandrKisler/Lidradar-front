<script setup lang="ts">
/**
 * Приём приглашения по коду (Figma «Принять приглашение»). Запрос идёт сеансом без организации; после
 * `200` обязательно перечитывается `/auth/me` — членство не собирается на
 * клиенте из ответа. Неизвестный код (`404`) объясняется нейтрально под полем.
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput } from '@/shared/ui'
import { useSessionStore, type MembershipSummary } from '@/entities/session'
import { acceptInvitation } from '@/entities/team'
import { acceptInvitationSchema } from '../model/schema'

defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean | undefined
}>()
const emit = defineEmits<{ accepted: [membership: MembershipSummary] }>()

const session = useSessionStore()
const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(acceptInvitationSchema),
  initialValues: { code: '' },
})
const [code] = defineField('code')

const submitError = ref<unknown>(null)
const formEl = useTemplateRef<HTMLFormElement>('formEl')
/**
 * Код принят (`200`), а перечитать членства не удалось: приглашение уже использовано, повторять
 * отправку кода нельзя — повторяется только чтение `/auth/me`.
 */
const acceptedMembership = ref<MembershipSummary | null>(null)
const refreshing = ref(false)
const unknownCode = computed(
  () => isApiError(submitError.value) && submitError.value.httpStatus === 404,
)
/** Ошибка поля: проверка формата или ответ «код неизвестен» — рядом с полем, а не в отдельной плашке. */
const codeError = computed(
  () =>
    errors.value.code ??
    (unknownCode.value
      ? 'Код недействителен или срок его действия истёк. Попросите владельца прислать новый.'
      : undefined),
)
const errorView = computed(() => {
  if (submitError.value === null || unknownCode.value) return null
  return describeError(submitError.value)
})
const traceId = computed(() => (isApiError(submitError.value) ? submitError.value.traceId : ''))
const alreadyMember = computed(
  () => isApiError(submitError.value) && submitError.value.code === 'ALREADY_MEMBER',
)

let inFlight = false
const onSubmit = handleSubmit(async (values) => {
  if (inFlight) return
  inFlight = true
  submitError.value = null
  // Новая отправка — новый код: состояние прежнего принятого приглашения к ней не относится.
  acceptedMembership.value = null
  try {
    acceptedMembership.value = (await acceptInvitation(values.code)).membership
    await finish()
  } catch (error) {
    submitError.value = error
  } finally {
    inFlight = false
  }
})

/** Поле было заблокировано на время отправки и потеряло фокус: после неудачи он возвращается к коду. */
async function submit(event?: Event): Promise<void> {
  await onSubmit(event)
  if (submitError.value === null && Object.keys(errors.value).length === 0) return
  await nextTick()
  // Код уже принят — нужное действие «Обновить список», а не поле кода.
  const target = acceptedMembership.value
    ? formEl.value?.querySelector<HTMLElement>('button[data-retry-refresh]')
    : formEl.value?.querySelector<HTMLElement>('input')
  target?.focus()
}

/** Перечитывает членства и сообщает родителю о принятом приглашении. */
async function finish(): Promise<void> {
  const membership = acceptedMembership.value
  if (!membership) return
  refreshing.value = true
  try {
    await session.refresh()
    submitError.value = null
    emit('accepted', membership)
  } finally {
    refreshing.value = false
  }
}
async function retryRefresh(): Promise<void> {
  submitError.value = null
  try {
    await finish()
  } catch (error) {
    submitError.value = error
    await nextTick()
    formEl.value?.querySelector<HTMLElement>('button[data-retry-refresh]')?.focus()
  }
}
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-6" role="status" aria-label="Загрузка">
    <div class="flex flex-col gap-2.5">
      <div class="flex h-[22px] items-center"><div class="h-3 w-40 rounded-full bg-line" /></div>
      <div class="h-[46px] rounded-field bg-line" />
      <div class="flex flex-col">
        <div class="flex h-5 items-center">
          <div class="h-3 w-[322px] max-w-full rounded-full md:w-[336px] bg-line" />
        </div>
        <div class="flex h-5 items-center md:hidden">
          <div class="h-3 w-[216px] rounded-full bg-line" />
        </div>
      </div>
    </div>
    <div
      class="flex flex-col gap-3 border-t border-hairline pt-5 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-col">
        <div class="flex h-5 items-center"><div class="h-3 w-36 rounded-full bg-line" /></div>
        <div class="mt-1 flex h-5 items-center">
          <div class="h-3 w-[156px] rounded-full bg-line" />
        </div>
      </div>
      <div class="h-[46px] rounded-button md:w-[200px] bg-line" />
    </div>
  </div>
  <form v-else ref="formEl" class="flex flex-col gap-6" novalidate @submit.prevent="submit">
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Код приглашения"
      description="43 символа. Скопируйте и вставьте код целиком."
      roomy
      :error="codeError"
    >
      <UiInput
        :id="id"
        v-model="code"
        name="code"
        autocomplete="off"
        spellcheck="false"
        :described-by="describedBy"
        :invalid="invalid"
        :disabled="isSubmitting"
      />
    </UiField>
    <UiAlert
      v-if="acceptedMembership && errorView"
      tone="warning"
      title="Приглашение принято, список пространств не обновился"
      :trace-id="traceId"
    >
      Код уже использован, отправлять его снова не нужно. Обновите список, чтобы открыть
      организацию.
      <UiButton
        class="mt-3"
        variant="secondary"
        data-retry-refresh
        :loading="refreshing"
        @click="retryRefresh"
        >Обновить список</UiButton
      >
    </UiAlert>
    <UiAlert v-else-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
      <template v-if="alreadyMember">
        <RouterLink :to="{ name: 'workspaces' }" class="font-semibold text-brand-dark underline">
          Открыть рабочие пространства
        </RouterLink>
      </template>
    </UiAlert>
    <div
      class="flex flex-col gap-3 border-t border-hairline pt-5 md:flex-row md:items-center md:justify-between"
    >
      <div class="text-sm leading-5">
        <p class="text-ink">Код действует 7 дней</p>
        <p class="mt-1 text-secondary">Используется один раз</p>
      </div>
      <UiButton type="submit" class="md:w-[200px]" :loading="isSubmitting">
        <template v-if="isSubmitting">
          <span aria-hidden="true">Проверяем…</span><span class="sr-only">Присоединиться</span>
        </template>
        <template v-else>Присоединиться</template>
      </UiButton>
    </div>
  </form>
</template>
