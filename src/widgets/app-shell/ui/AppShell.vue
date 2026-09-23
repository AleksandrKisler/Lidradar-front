<script setup lang="ts">
/**
 * Оболочка рабочего пространства: тёмное боковое меню (232 px на десктопе),
 * шапка с названием раздела и область содержимого. На узких экранах меню
 * открывается модально с ловушкой фокуса.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { UiDialog } from '@/shared/ui'
import { roleLabel, useSessionStore } from '@/entities/session'
import { LogoutButton } from '@/features/auth-session'
import { WorkspaceSwitcher } from '@/features/select-workspace'
import RealtimeBadge from './RealtimeBadge.vue'
import SidebarNav from './SidebarNav.vue'

const emit = defineEmits<{
  loggedOut: [result: { confirmed: boolean }]
  workspaceSwitched: [tenantId: string]
}>()

const session = useSessionStore()
const route = useRoute()
const menuOpen = ref(false)

const title = computed(() => route.meta.title ?? 'LidRadar')
const organizationName = computed(() => session.membership?.organizationName ?? '')
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
  >
    К основному содержимому
  </a>
  <div class="min-h-dvh md:grid md:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
    <aside class="hidden bg-nav text-white md:flex md:flex-col md:gap-8 md:p-6">
      <p class="text-xl font-bold tracking-tight">◉ LidRadar</p>
      <WorkspaceSwitcher @switched="(id) => emit('workspaceSwitched', id)" />
      <SidebarNav />
      <div class="mt-auto border-t border-nav-active pt-5">
        <p class="truncate text-sm font-semibold text-white">{{ session.user?.displayName }}</p>
        <p class="text-xs text-nav-text">{{ session.role ? roleLabel(session.role) : '' }}</p>
        <div class="mt-3">
          <LogoutButton
            variant="secondary"
            block
            @logged-out="(result) => emit('loggedOut', result)"
          />
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      <header
        class="flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3 md:px-12"
      >
        <div class="min-w-0">
          <p class="truncate text-xs font-semibold tracking-wide text-muted uppercase">
            {{ organizationName }}
          </p>
          <p class="truncate text-lg font-bold text-ink">{{ title }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <!-- Обёртка, а не класс на бейдже: утилита display компонента не должна спорить с `hidden`. -->
          <div class="hidden sm:block">
            <RealtimeBadge />
          </div>
          <button
            type="button"
            class="rounded-control border border-line px-3 py-2 text-sm font-semibold md:hidden"
            aria-haspopup="dialog"
            @click="menuOpen = true"
          >
            Меню
          </button>
        </div>
      </header>
      <main id="main" class="flex-1 px-5 py-6 md:px-12 md:py-10">
        <slot />
      </main>
    </div>
  </div>

  <UiDialog v-model:open="menuOpen" title="Меню">
    <div class="mb-4"><RealtimeBadge /></div>
    <div class="flex flex-col gap-6 rounded-control bg-nav p-5 text-white">
      <WorkspaceSwitcher
        @switched="
          (id) => {
            menuOpen = false
            emit('workspaceSwitched', id)
          }
        "
      />
      <SidebarNav @navigate="menuOpen = false" />
      <div class="border-t border-nav-active pt-4">
        <p class="text-sm font-semibold">{{ session.user?.displayName }}</p>
        <div class="mt-3">
          <LogoutButton
            variant="secondary"
            block
            @logged-out="(result) => emit('loggedOut', result)"
          />
        </div>
      </div>
    </div>
  </UiDialog>
</template>
