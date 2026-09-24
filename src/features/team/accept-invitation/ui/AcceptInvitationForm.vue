<script setup lang="ts">
/**
 * Приём приглашения по коду. Запрос идёт сеансом без организации; после
 * `200` обязательно перечитывается `/auth/me` — членство не собирается на
 * клиенте из ответа. Неизвестный код (`404`) объясняется нейтрально.
 */
import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiField, UiInput } from '@/shared/ui'
import { useSessionStore, type MembershipSummary } from '@/entities/session'
import { acceptInvitation } from '@/entities/team'
import { acceptInvitationSchema } from '../model/schema'

const emit = defineEmits<{ accepted: [membership: MembershipSummary] }>()

const session = useSessionStore()
const { defineField, handleSubmit, errors, isSubmitting } = useForm({
  validationSchema: toTypedSchema(acceptInvitationSchema),
  initialValues: { code: '' },
})
const [code] = defineField('code')

const submitError = ref<unknown>(null)
const errorView = computed(() => {
  if (submitError.value === null) return null
  if (isApiError(submitError.value) && submitError.value.httpStatus === 404) {
    return {
      title: 'Код не найден',
      description:
        'Проверьте, что код скопирован полностью. Если он верный, попросите владельца выпустить новый.',
    }
  }
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
  try {
    const accepted = await acceptInvitation(values.code)
    await session.refresh()
    emit('accepted', accepted.membership)
  } catch (error) {
    submitError.value = error
  } finally {
    inFlight = false
  }
})
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
    <UiField
      v-slot="{ id, describedBy, invalid }"
      label="Код приглашения"
      description="43 символа, которые передал владелец организации. Код действует 7 дней и один раз."
      :error="errors.code"
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
    <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
      {{ errorView.description }}
      <template v-if="alreadyMember">
        <RouterLink :to="{ name: 'workspaces' }" class="font-semibold text-brand-dark underline">
          Открыть рабочие пространства
        </RouterLink>
      </template>
    </UiAlert>
    <div>
      <UiButton type="submit" :loading="isSubmitting">Присоединиться</UiButton>
    </div>
  </form>
</template>
