<script setup lang="ts">
/**
 * Данные и закрытие аккаунта для пользователя без организации (ADR 0059). Права на личные данные не зависят
 * от членства, поэтому те же карточки, что в «Настройки → Аккаунт», доступны и здесь: из разметки без боковой
 * панели, куда попадает пользователь, у которого организации нет или ещё не выбрана.
 */
import { UiCard } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { AccountDeletionCard, ExportAccountDataCard } from '@/features/auth-session'

const session = useSessionStore()
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col gap-6">
    <UiCard as="section" aria-labelledby="account-title">
      <h1 id="account-title" class="text-2xl font-bold text-ink">Аккаунт и данные</h1>
      <p class="mt-2 text-sm break-all text-muted" data-testid="account-email">
        {{ session.user?.email }}
      </p>
    </UiCard>
    <ExportAccountDataCard />
    <AccountDeletionCard />
    <p class="text-sm text-muted">
      <RouterLink
        :to="{ name: 'workspaces' }"
        class="font-semibold text-brand-dark hover:underline"
      >
        Назад к рабочим пространствам
      </RouterLink>
    </p>
  </div>
</template>
