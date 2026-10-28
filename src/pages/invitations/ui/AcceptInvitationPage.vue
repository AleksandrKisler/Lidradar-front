<script setup lang="ts">
/**
 * Принятие приглашения по коду (Figma 477:8455 и состояния). Доступно любому сеансу без выбранной
 * организации: сотрудник входит, вводит код и получает рабочее пространство.
 * После успеха предлагается открыть его явно — с очисткой кеша прежней
 * организации, если она была выбрана.
 */
import { nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiButton, UiCard, UiPageIntro } from '@/shared/ui'
import { roleLabel, useSessionStore, type MembershipSummary } from '@/entities/session'
import { AcceptInvitationForm } from '@/features/team/accept-invitation'
import { useSwitchWorkspace } from '@/features/select-workspace'

defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Принять приглашение · Первичная загрузка»). */
  loading?: boolean
}>()

const router = useRouter()
const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()
const accepted = ref<MembershipSummary | null>(null)
const heading = ref<HTMLElement | null>(null)
// Форма исчезла вместе с полем: фокус переносится на заголовок результата.
watch(accepted, async (value) => {
  if (!value) return
  await nextTick()
  heading.value?.focus()
})

async function openWorkspace(): Promise<void> {
  if (!accepted.value) return
  if (await switchTo(accepted.value.tenantId)) await router.replace({ name: 'radar' })
}
</script>

<template>
  <UiCard v-if="accepted" :padded="false" class="p-[23px] md:p-[31px]">
    <h1 ref="heading" tabindex="-1" class="text-2xl font-bold text-ink focus:outline-none">
      Вы в команде
    </h1>
    <p class="mt-2 text-sm leading-6 text-muted">
      Организация «{{ accepted.organizationName }}» добавлена в ваши рабочие пространства. Ваша роль
      — {{ roleLabel(accepted.role) }}.
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <UiButton @click="openWorkspace">Открыть рабочее пространство</UiButton>
      <RouterLink
        v-if="session.memberships.length > 1"
        :to="{ name: 'workspaces' }"
        class="inline-flex h-input items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
      >
        Все пространства
      </RouterLink>
    </div>
  </UiCard>
  <div v-else>
    <UiPageIntro
      title="Принять приглашение"
      description="Введите код, который передал владелец организации. Она появится в списке рабочих пространств с ролью, которую назначил владелец."
    />
    <UiCard :padded="false" class="p-[19px] md:p-[27px]">
      <AcceptInvitationForm :loading="loading" @accepted="accepted = $event" />
    </UiCard>
    <p class="mt-[42px] text-sm md:max-lg:mt-[51px] leading-5 text-secondary">
      <RouterLink
        v-if="loading || session.memberships.length > 0"
        :to="{ name: 'workspaces' }"
        class="text-link hover:underline"
      >
        Вернуться к рабочим пространствам
      </RouterLink>
      <RouterLink
        v-else-if="session.canCreateOrganization"
        :to="{ name: 'onboarding-company' }"
        class="text-link hover:underline"
      >
        Создать свою организацию
      </RouterLink>
      <template v-else>
        Своя организация создаётся по приглашению платформы. Если оно у вас есть, зарегистрируйтесь
        с ним заново.
      </template>
    </p>
  </div>
</template>
