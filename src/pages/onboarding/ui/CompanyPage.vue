<script setup lang="ts">
/**
 * Шаг 1 по существующему макету «Компания»: при возврате редактируется выбранная компания.
 * Отдельный запрос нового пространства задаётся ссылкой из списка пространств.
 */
import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { UiAccessDenied, UiAlert, UiButton, UiErrorState, UiIcon, UiPageIntro } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { fetchOrganization, organizationKeys, type Organization } from '@/entities/organization'
import { CreateOrganizationForm } from '@/features/create-organization'
import { useOnboardingState } from '../model/state'

const props = defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean
}>()

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const state = useOnboardingState()
const requested = typeof route.query.company === 'string' ? route.query.company : null
const confirmed = ref(requested !== null)
/**
 * Право создать организацию читается один раз при открытии страницы (ADR 0057). Создание тратит право,
 * и после перечитывания сессии `canCreateOrganization` становится ложным: форма, привязанная к живому
 * значению, размонтировалась бы раньше, чем сообщит об успехе, и переход к следующему шагу потерялся бы.
 */
const mayCreate = session.canCreateOrganization
const editingTenant = ref(route.query.new === '1' ? null : (requested ?? session.tenantId))
let active = true
onBeforeUnmount(() => {
  active = false
})
const owner = session.user?.id
const organization = useQuery({
  queryKey: computed(() => organizationKeys.detail(editingTenant.value ?? '')),
  enabled: computed(
    () =>
      !props.loading &&
      editingTenant.value !== null &&
      (requested !== null || session.can('organization.manage')),
  ),
  retry: false,
  staleTime: requested ? 0 : 300_000,
  queryFn: async ({ signal }) => {
    if (requested) {
      await session.refresh()
      if (
        !active ||
        session.user?.id !== owner ||
        !session.selectTenant(requested) ||
        !session.can('organization.manage')
      )
        throw new Error('Компания недоступна')
    }
    return fetchOrganization(editingTenant.value!, signal)
  },
})
const editing = computed(() => editingTenant.value !== null)
const formLoading = computed(
  () =>
    props.loading ||
    (editing.value && organization.isPending.value) ||
    (requested !== null && organization.isFetching.value),
)
const actionLabel = computed(() =>
  editing.value || confirmed.value ? 'Сохранить и продолжить' : 'Создать компанию',
)

watch(
  () => session.tenantId,
  (tenantId) => {
    // Во время первого POST /auth/me выбирает созданную компанию до события created.
    if (editing.value && !requested) editingTenant.value = tenantId
  },
)
watchEffect(() => {
  if (
    !props.loading &&
    !confirmed.value &&
    route.name === 'onboarding-company' &&
    route.query.new !== '1' &&
    session.memberships.length &&
    !session.tenantId
  ) {
    void router.replace({ name: 'workspaces', query: { redirect: '/onboarding/company' } })
  }
})

async function onCreated(created: Organization): Promise<void> {
  editingTenant.value = created.id
  if (!active) return
  // Сохраняем шаг 1 в истории уже как редактор созданной компании, без намерения new.
  await router.replace({ name: 'onboarding-company' })
  if (!active) return
  await router.push({ name: 'onboarding-location' })
}
function onSaved(): void {
  if (active) void router.push({ name: 'onboarding-location' })
}
function acknowledge(created: Organization) {
  confirmed.value = true
  return router.replace({ name: 'onboarding-company', query: { company: created.id } })
}
</script>

<template>
  <div>
    <UiPageIntro
      compact
      title="Расскажите о компании"
      description="Эти данные задают контекст рисков, местное время и валюту расчётов."
    />
    <UiErrorState
      v-if="editing && organization.isError.value && (requested || !organization.data.value)"
      :error="organization.error.value"
      title="Не удалось загрузить компанию"
      @retry="organization.refetch()"
    />
    <UiAccessDenied
      v-else-if="
        !loading &&
        (!requested || !organization.isFetching.value) &&
        editing &&
        !session.can('organization.manage')
      "
    />
    <CreateOrganizationForm
      v-else-if="editing || mayCreate || loading"
      :key="editingTenant ?? 'new'"
      :loading="formLoading"
      :organization="editing ? organization.data.value : undefined"
      :draft="state?.company.value"
      :acknowledge="acknowledge"
      @draft="state && (state.company.value = $event)"
      @created="onCreated"
      @saved="onSaved"
    >
      <template #default="{ submitting }">
        <div class="flex flex-col-reverse gap-5 md:flex-col md:gap-[30px]">
          <div class="flex gap-3 md:px-[31px]">
            <UiIcon name="info" class="mt-0.5 size-5 shrink-0 text-secondary" />
            <p class="text-note text-secondary">
              <span class="font-medium text-ink">Вы управляете действиями.</span><br />
              LidRadar помогает заметить риск и выбрать следующий шаг.<br />
              Самостоятельно клиентам не пишет.
            </p>
          </div>
          <div class="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
            <p class="text-sm leading-5 text-secondary">Далее: Точка и график</p>
            <div
              v-if="formLoading"
              class="flex h-input items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted md:w-[268px]"
            >
              {{ actionLabel }}
            </div>
            <UiButton
              v-else
              type="submit"
              class="md:w-[268px]"
              :loading="submitting"
              :block="false"
            >
              <template v-if="submitting">
                <span aria-hidden="true">{{
                  editing || confirmed ? 'Сохраняем…' : 'Создаём компанию…'
                }}</span
                ><span class="sr-only">{{ actionLabel }}</span>
              </template>
              <template v-else>{{ actionLabel }}</template>
            </UiButton>
          </div>
        </div>
      </template>
    </CreateOrganizationForm>
    <UiAlert v-else tone="info" title="Организацию создают по приглашению платформы">
      У вашей учётной записи нет права создать организацию. Если вас пригласили в компанию, примите
      приглашение сотрудника; новую организацию можно создать с кодом приглашения платформы.
    </UiAlert>
    <div
      class="mt-[26px] flex flex-col items-center gap-2 border-t border-hairline pt-6 text-sm leading-5 text-secondary lg:-mx-10"
    >
      <p v-if="!loading && session.memberships.length">
        <RouterLink :to="{ name: 'workspaces' }" class="text-link hover:underline">
          Вернуться к рабочим пространствам
        </RouterLink>
      </p>
      <p class="flex items-center gap-2">
        Вас пригласили в существующую компанию?
        <RouterLink
          :to="{ name: 'invitations-accept' }"
          class="inline-flex items-center gap-2 text-link hover:underline"
        >
          Принять приглашение<UiIcon name="expand-more" class="size-4 -rotate-90" />
        </RouterLink>
      </p>
    </div>
  </div>
</template>
