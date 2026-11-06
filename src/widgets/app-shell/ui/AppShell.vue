<script setup lang="ts">
/**
 * Оболочка рабочего пространства по Figma (Radar, 21:1983): светлая боковая
 * колонка 240 px, область содержимого с отступом 40 px. Страницы дизайна v2
 * (`meta.v2`) сами рисуют контекст и заголовок; верхняя полоса остаётся на
 * узких экранах (меню, бренд) и на ещё не перенесённых страницах. На узких
 * экранах меню открывается на весь экран с ловушкой фокуса.
 *
 * Маршруты с `meta.shell === 'radar'` получают общую оболочку C — `RadarShell`.
 * Вариант применяется к Radar/risk, диалогам, аналитике, интеграциям и настройкам.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { UiDialog, UiIcon } from '@/shared/ui'
import { AccountDeletionBanner, EmailVerificationBanner } from '@/features/auth-session'
import RealtimeBadge from './RealtimeBadge.vue'
import SidebarBody from './SidebarBody.vue'
import RadarShell from './RadarShell.vue'
import { useSessionStore } from '@/entities/session'

const emit = defineEmits<{
  loggedOut: [result: { confirmed: boolean }]
  workspaceSwitched: [tenantId: string]
}>()

const session = useSessionStore()
const route = useRoute()
const menuOpen = ref(false)

const title = computed(() => route.meta.title ?? 'LidRadar')
const v2 = computed(() => route.meta.v2 === true)
const organizationName = computed(() => session.membership?.organizationName ?? '')
const radarShell = computed(() => route.meta.shell === 'radar')
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
  >
    К основному содержимому
  </a>
  <RadarShell
    v-if="radarShell"
    @logged-out="(result) => emit('loggedOut', result)"
    @workspace-switched="(id) => emit('workspaceSwitched', id)"
  >
    <slot />
  </RadarShell>
  <div v-else class="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
    <aside
      class="hidden border-r border-hairline bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start lg:overflow-y-auto lg:p-6"
    >
      <SidebarBody
        @logged-out="(result) => emit('loggedOut', result)"
        @workspace-switched="(id) => emit('workspaceSwitched', id)"
      />
    </aside>

    <div class="flex min-w-0 flex-col">
      <header
        v-if="v2"
        class="flex h-20 items-center gap-4 border-b border-hairline bg-paper px-4 md:px-8 lg:hidden"
      >
        <button
          type="button"
          class="-ml-1 flex size-10 items-center justify-center rounded-full text-ink hover:bg-canvas"
          aria-label="Меню"
          aria-haspopup="dialog"
          @click="menuOpen = true"
        >
          <UiIcon name="menu" class="size-6" />
        </button>
        <p class="flex items-center gap-2 text-xl leading-7 font-semibold text-ink">
          <UiIcon name="radar" class="size-7" />LidRadar
        </p>
      </header>
      <header
        v-else
        class="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3 lg:px-10"
      >
        <div class="min-w-0">
          <p class="truncate text-xs leading-[18px] text-muted">{{ organizationName }}</p>
          <p class="truncate text-lg leading-6 font-semibold text-ink">{{ title }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <!-- Обёртка, а не класс на бейдже: утилита display компонента не должна спорить с `hidden`. -->
          <div class="hidden sm:block">
            <RealtimeBadge />
          </div>
          <button
            type="button"
            class="-mr-2 flex size-10 items-center justify-center rounded-full text-ink hover:bg-canvas lg:hidden"
            aria-label="Меню"
            aria-haspopup="dialog"
            @click="menuOpen = true"
          >
            <UiIcon name="menu" class="size-6" />
          </button>
        </div>
      </header>
      <EmailVerificationBanner />
      <AccountDeletionBanner />
      <main id="main" class="flex-1 px-4 py-6 md:px-8 lg:px-10 lg:py-8">
        <slot />
      </main>
    </div>
  </div>

  <UiDialog v-if="!radarShell" v-model:open="menuOpen" title="Меню" size="full" tone="panel">
    <div class="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <RealtimeBadge />
      <SidebarBody
        @navigate="menuOpen = false"
        @logged-out="(result) => emit('loggedOut', result)"
        @workspace-switched="
          (id) => {
            menuOpen = false
            emit('workspaceSwitched', id)
          }
        "
      />
    </div>
  </UiDialog>
</template>
