<script setup lang="ts">
/**
 * Принятие приглашения по коду. Доступно любому сеансу без выбранной
 * организации: сотрудник входит, вводит код и получает рабочее пространство.
 * После успеха предлагается открыть его явно — с очисткой кеша прежней
 * организации, если она была выбрана.
 */
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiButton, UiCard } from '@/shared/ui'
import { roleLabel, useSessionStore, type MembershipSummary } from '@/entities/session'
import { AcceptInvitationForm } from '@/features/team/accept-invitation'
import { useSwitchWorkspace } from '@/features/select-workspace'

const router = useRouter()
const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()
const accepted = ref<MembershipSummary | null>(null)

async function openWorkspace(): Promise<void> {
  if (!accepted.value) return
  if (await switchTo(accepted.value.tenantId)) await router.replace({ name: 'radar' })
}
</script>

<template>
  <UiCard>
    <template v-if="accepted">
      <h1 class="text-2xl font-bold text-ink">Вы в команде</h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        Организация «{{ accepted.organizationName }}» добавлена в ваши рабочие пространства. Ваша
        роль — {{ roleLabel(accepted.role) }}.
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <UiButton @click="openWorkspace">Открыть рабочее пространство</UiButton>
        <RouterLink
          v-if="session.memberships.length > 1"
          :to="{ name: 'workspaces' }"
          class="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-ink hover:bg-canvas"
        >
          Все пространства
        </RouterLink>
      </div>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold text-ink">Принять приглашение</h1>
      <p class="mt-2 text-sm leading-6 text-muted">
        Владелец организации передал вам код. Введите его — и организация появится в списке ваших
        рабочих пространств с той ролью, которую назначил владелец.
      </p>
      <div class="mt-6">
        <AcceptInvitationForm @accepted="accepted = $event" />
      </div>
      <p class="mt-6 text-sm text-muted">
        <RouterLink
          v-if="session.memberships.length > 0"
          :to="{ name: 'workspaces' }"
          class="font-semibold text-brand-dark hover:underline"
        >
          Вернуться к рабочим пространствам
        </RouterLink>
        <RouterLink
          v-else
          :to="{ name: 'onboarding-company' }"
          class="font-semibold text-brand-dark hover:underline"
        >
          Создать свою организацию
        </RouterLink>
      </p>
    </template>
  </UiCard>
</template>
