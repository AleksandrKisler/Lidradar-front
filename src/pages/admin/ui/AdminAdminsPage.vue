<script setup lang="ts">
/** Администраторы платформы: история выдач, включая отозванные; выдача и отзыв. */
import { formatDateTime } from '@/shared/lib'
import { UiBadge, UiCard, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { usePlatformAdminsQuery } from '@/entities/admin'
import { GrantAdminForm } from '@/features/admin/grant-admin'
import { RevokeAdminButton } from '@/features/admin/revoke-admin'
import { IdCell, SnapshotBar } from '@/widgets/admin-shell'

const session = useSessionStore()
const admins = usePlatformAdminsQuery()
</script>

<template>
  <div class="flex flex-col gap-6">
    <UiCard as="section" aria-labelledby="grant-title">
      <h2 id="grant-title" class="text-lg font-bold text-ink">Выдать право</h2>
      <p class="mt-1 text-sm text-muted">
        Право не связано с организациями и записывается в аудит администрирования. Первый
        администратор выдаётся из CLI.
      </p>
      <div class="mt-4"><GrantAdminForm /></div>
    </UiCard>
    <SnapshotBar
      :updated-at="admins.dataUpdatedAt.value"
      :loading="admins.isFetching.value"
      @refresh="admins.refetch()"
    />
    <UiCard as="section" aria-labelledby="admins-title">
      <h2 id="admins-title" class="text-lg font-bold text-ink">Выдачи</h2>
      <div
        v-if="admins.isPending.value"
        class="mt-4"
        role="status"
        aria-label="Загрузка администраторов"
      >
        <UiSkeleton class="h-16 w-full" />
      </div>
      <UiErrorState
        v-else-if="admins.isError.value"
        class="mt-4"
        :error="admins.error.value"
        title="Не удалось загрузить администраторов"
        @retry="admins.refetch()"
      />
      <ul
        v-else-if="admins.data.value"
        class="mt-4 divide-y divide-line"
        aria-label="Администраторы платформы"
      >
        <li
          v-for="admin in admins.data.value"
          :key="admin.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-ink">{{
                admin.displayName ?? admin.email ?? admin.userId
              }}</span>
              <span v-if="admin.email && admin.displayName" class="text-muted">{{
                admin.email
              }}</span>
              <span v-if="admin.userId === session.user?.id" class="text-xs text-muted">· вы</span>
              <UiBadge :tone="admin.revokedAt ? 'neutral' : 'success'">{{
                admin.revokedAt ? 'Отозвано' : 'Действует'
              }}</UiBadge>
            </div>
            <p class="mt-1 text-xs text-muted">
              Пользователь <IdCell :value="admin.userId" /> · выдано
              {{ formatDateTime(admin.grantedAt, 'UTC') }} ·
              {{ admin.grantedBy ? 'администратором' : 'из CLI'
              }}<template v-if="admin.revokedAt">
                · отозвано {{ formatDateTime(admin.revokedAt, 'UTC') }}</template
              >
            </p>
            <p v-if="admin.note" class="mt-1 text-xs text-ink break-words">{{ admin.note }}</p>
          </div>
          <RevokeAdminButton
            v-if="!admin.revokedAt"
            :admin="admin"
            :current-user-id="session.user?.id ?? ''"
          />
        </li>
      </ul>
    </UiCard>
  </div>
</template>
