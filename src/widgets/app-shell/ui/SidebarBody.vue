<script setup lang="ts">
/**
 * Содержимое бокового меню (Figma 21:1983): бренд, рабочее пространство,
 * разделы, «Настройки» и профиль. Общее для боковой колонки и мобильного
 * меню. Статус Telegram берётся из кэша статуса настройки и виден только
 * ролям с правом настройки (см. SidebarTelegramStatus).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { UiIcon } from '@/shared/ui'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useAdminMeQuery } from '@/entities/admin'
import { LogoutButton } from '@/features/auth-session'
import { WorkspaceSwitcher } from '@/features/select-workspace'
import SidebarNav from './SidebarNav.vue'
import SidebarTelegramStatus from './SidebarTelegramStatus.vue'

const emit = defineEmits<{
  navigate: []
  loggedOut: [result: { confirmed: boolean }]
  workspaceSwitched: [tenantId: string]
}>()

const session = useSessionStore()
// Ссылка на администрирование появляется только по признаку сервера.
const adminMe = useAdminMeQuery()
const isPlatformAdmin = computed(() => adminMe.data.value?.platformAdmin === true)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6">
    <div class="flex flex-col gap-6">
      <p class="flex h-8 items-center gap-2 text-xl leading-7 font-semibold text-ink">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
      <WorkspaceSwitcher @switched="(id) => emit('workspaceSwitched', id)" />
      <div class="h-px bg-line" aria-hidden="true" />
      <SidebarNav @navigate="emit('navigate')" />
    </div>
    <div class="flex flex-col gap-3">
      <SidebarTelegramStatus />
      <SidebarNav group="bottom" @navigate="emit('navigate')" />
      <div class="h-px bg-line" aria-hidden="true" />
      <div class="flex flex-col gap-1">
        <p class="truncate text-sm leading-5 font-medium text-ink">
          {{ session.user?.displayName }}
        </p>
        <p class="text-xs leading-[18px] text-secondary">
          {{ session.role ? roleLabel(session.role) : '' }}
        </p>
        <RouterLink
          :to="{ name: 'account' }"
          class="text-sm leading-5 text-link hover:underline"
          @click="emit('navigate')"
          >Аккаунт&nbsp;&nbsp;→</RouterLink
        >
        <RouterLink
          v-if="isPlatformAdmin"
          :to="{ name: 'admin-overview' }"
          class="text-sm leading-5 text-link hover:underline"
          @click="emit('navigate')"
        >
          Администрирование
        </RouterLink>
      </div>
      <LogoutButton
        variant="secondary"
        class="h-10! rounded-lg! border-[#d2d2d7]!"
        block
        @logged-out="(result) => emit('loggedOut', result)"
      />
    </div>
  </div>
</template>
