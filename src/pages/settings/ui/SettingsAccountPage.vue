<script setup lang="ts">
/**
 * Аккаунт: адрес почты, смена пароля (ADR 0058), выгрузка личных данных и закрытие аккаунта (ADR 0059).
 * Раздел относится к пользователю, а не к организации, поэтому доступен любой роли. Подтверждение почты мягкое: статус честно показывает, что работа от него
 * не зависит, а письмо можно запросить заново.
 */
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib'
import { UiBadge, UiCard, UiPageHeader } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import {
  AccountDeletionCard,
  ChangePasswordForm,
  ExportAccountDataCard,
  ResendVerificationButton,
} from '@/features/auth-session'
import SettingsTabs from './SettingsTabs.vue'

const session = useSessionStore()
const verifiedAt = computed(() => session.user?.emailVerifiedAt ?? null)
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiPageHeader title="Аккаунт" subtitle="Электронная почта и пароль" />
    <SettingsTabs />

    <UiCard as="section" aria-labelledby="email-title">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="email-title" class="text-lg font-bold text-ink">Электронная почта</h2>
          <p class="mt-1 text-sm break-all text-ink" data-testid="account-email">
            {{ session.user?.email }}
          </p>
        </div>
        <UiBadge :tone="verifiedAt ? 'success' : 'warning'">
          {{ verifiedAt ? 'Подтверждена' : 'Не подтверждена' }}
        </UiBadge>
      </div>
      <p v-if="verifiedAt" class="mt-3 text-sm text-muted">
        Адрес подтверждён {{ formatDateTime(verifiedAt, 'UTC') }} (UTC).
      </p>
      <template v-else>
        <p class="mt-3 text-sm text-muted">
          Подтверждение необязательно: сервис работает и без него. Подтверждённый адрес нужен для
          писем о безопасности аккаунта. Мы отправили письмо со ссылкой при регистрации; если его
          нет, запросите новое.
        </p>
        <div class="mt-4"><ResendVerificationButton /></div>
      </template>
    </UiCard>

    <UiCard as="section" aria-labelledby="password-title">
      <h2 id="password-title" class="text-lg font-bold text-ink">Смена пароля</h2>
      <p class="mt-1 mb-5 text-sm text-muted">
        После смены вы останетесь в этом браузере, а на остальных устройствах выйдете из аккаунта.
      </p>
      <ChangePasswordForm />
    </UiCard>

    <ExportAccountDataCard />
    <AccountDeletionCard />
  </div>
</template>
