<script setup lang="ts">
/**
 * Общая оболочка C Radar, диалогов, аналитики, интеграций и настроек
 * (Figma: desktop 27:2765 / 220:2548, sidebar 27:2766,
 * header 27:2809; tablet 630:6182 / 220:2755, app bar 1048:9337; phone 630:7204 / 220:2970,
 * app bar 1048:9359; меню 630:8277 / 630:8361).
 *
 * Desktop: облегчённая колонка 240 px с разделами и рабочим пространством внизу; шапка
 * содержимого — контекст слева, дата, имя, «Аккаунт →», настройки и «Выйти» справа.
 * Планшет и телефон: шапка приложения 72 / 64 px с меню, брендом, аккаунтом и настройками;
 * контекст и дата — отдельной строкой ниже. Выход и администрирование на узких экранах —
 * прежним путём через страницу аккаунта. Контекст рисует только оболочка: страницы его не
 * повторяют. Дата — в часовом поясе организации и только после её загрузки.
 */
import { computed, onScopeDispose, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { formatLongDateTime } from '@/shared/lib'
import { useRealtimeState } from '@/shared/api'
import { UiDialog, UiGlyph, UiIcon } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useOrganizationQuery } from '@/entities/organization'
import { useLocationsQuery } from '@/entities/location'
import {
  AccountDeletionBanner,
  EmailVerificationBanner,
  LogoutButton,
} from '@/features/auth-session'
import { WorkspaceSwitcher } from '@/features/select-workspace'
import { accountInitials } from '../model/account'
import RadarNav from './RadarNav.vue'
import RealtimeBadge from './RealtimeBadge.vue'
import { isSectionCurrent } from '../model/navigation'

const emit = defineEmits<{
  loggedOut: [result: { confirmed: boolean }]
  workspaceSwitched: [tenantId: string]
}>()

const session = useSessionStore()
const route = useRoute()
const menuOpen = ref(false)

const settingsCurrent = computed(() => isSectionCurrent('/settings', false, route.name))
const locationContext = computed(() =>
  ['radar', 'risk', 'conversations', 'conversation'].includes(String(route.name)),
)
const radarContext = computed(() => ['radar', 'risk'].includes(String(route.name)))
// Settings snapshots keep their own dates; the shared header must not add a Radar date there.
const organization = useOrganizationQuery(() => (settingsCurrent.value ? null : session.tenantId))
const locations = useLocationsQuery(() => session.tenantId)

const organizationName = computed(() => session.membership?.organizationName ?? '')
const displayName = computed(() => session.user?.displayName ?? '')
const initials = computed(() => accountInitials(displayName.value))
/** Точка из фильтра ленты; в остальных случаях — «Все точки», как в макетах. */
const locationLabel = computed(() => {
  const id = route.query.locationId
  return (
    (typeof id === 'string' && locations.data.value?.find((item) => item.id === id)?.name) ||
    'Все точки'
  )
})
const contextSuffix = computed(() =>
  settingsCurrent.value ? 'Настройки' : locationContext.value ? locationLabel.value : null,
)
const realtime = useRealtimeState()
// Preserve the former header's visible loss-of-updates warning on the newly moved modules.
// Radar already exposes the same state through its refresh control.
const transportWarning = computed(
  () => realtime.value === 'offline' || realtime.value === 'backoff',
)

const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))
const timeZone = computed(() => organization.data.value?.defaultTimezone ?? null)
const dateLabel = computed(() =>
  !settingsCurrent.value && timeZone.value ? formatLongDateTime(now.value, timeZone.value) : null,
)

function onSwitched(tenantId: string): void {
  menuOpen.value = false
  emit('workspaceSwitched', tenantId)
}
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
    <!-- Правое поле 23 px + рамка 1 px: содержимое 192 px, как в Figma 27:2766. -->
    <aside
      class="hidden border-r border-hairline bg-panel lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:gap-6 lg:self-start lg:overflow-y-auto lg:py-6 lg:pr-[23px] lg:pl-6"
    >
      <div class="flex flex-col gap-6">
        <p class="flex h-8 items-center gap-2 text-xl leading-7 font-semibold text-ink">
          <UiIcon name="radar" class="size-7" />LidRadar
        </p>
        <RadarNav />
      </div>
      <div class="flex flex-col gap-3">
        <span class="h-px bg-line" aria-hidden="true" />
        <WorkspaceSwitcher variant="sidebar" @switched="onSwitched" />
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      <header
        class="flex h-16 items-center justify-between gap-2 border-b border-line px-4 md:h-[72px] md:gap-4 md:px-8 lg:hidden"
      >
        <div class="flex min-w-0 items-center gap-2">
          <button
            type="button"
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-segment"
            aria-label="Меню"
            aria-haspopup="dialog"
            @click="menuOpen = true"
          >
            <UiIcon name="menu" class="size-6" />
          </button>
          <p class="flex h-8 items-center gap-2 text-xl leading-7 font-semibold text-ink">
            <UiIcon name="radar" class="size-7" />LidRadar
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2 md:gap-4">
          <p
            class="hidden max-w-64 truncate text-sm leading-5 font-medium text-ink md:block"
            :title="displayName"
          >
            {{ displayName }}
          </p>
          <RouterLink
            :to="{ name: 'account' }"
            class="hidden h-11 min-w-[93px] items-center justify-center text-sm leading-5 text-link hover:underline md:flex"
            >Аккаунт&nbsp;→</RouterLink
          >
          <RouterLink
            :to="{ name: 'account' }"
            class="flex size-11 items-center justify-center rounded-full border border-line bg-paper text-base leading-5 text-brand hover:bg-brand-pale md:hidden"
            :aria-label="displayName ? `Аккаунт, ${displayName}` : 'Аккаунт'"
            :title="displayName || undefined"
          >
            <span aria-hidden="true">{{ initials }}</span>
          </RouterLink>
          <RouterLink
            to="/settings"
            class="flex size-11 items-center justify-center text-ink hover:bg-segment"
            :class="settingsCurrent ? 'rounded-lg bg-nav-selected' : 'rounded-full'"
            :aria-current="settingsCurrent ? 'page' : undefined"
            aria-label="Настройки"
            title="Настройки"
          >
            <UiGlyph name="cog" class="size-5" />
          </RouterLink>
        </div>
      </header>
      <EmailVerificationBanner />
      <AccountDeletionBanner />
      <main
        id="main"
        class="flex flex-1 flex-col gap-4 px-4 pt-4 pb-6 md:gap-6 md:px-8 md:py-6 lg:px-10 lg:py-8"
      >
        <div
          class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs leading-[18px] text-muted md:gap-x-4 lg:min-h-11 lg:gap-x-5 lg:gap-y-2"
        >
          <p class="min-w-0 break-words">
            <!-- Один разделитель в тексте; шире на desktop (двойные пробелы в Figma 27:2810). -->
            {{ organizationName
            }}<template v-if="contextSuffix"
              >&nbsp;<span class="lg:mx-1">/</span> {{ contextSuffix }}</template
            >
          </p>
          <div class="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
            <p v-if="dateLabel">{{ dateLabel }}</p>
            <div class="hidden items-center gap-5 lg:flex">
              <span class="h-7 w-px bg-line" aria-hidden="true" />
              <p
                class="max-w-64 truncate text-sm leading-5 font-medium text-ink"
                :title="displayName"
              >
                {{ displayName }}
              </p>
              <RouterLink
                :to="{ name: 'account' }"
                class="flex h-11 min-w-[93px] items-center justify-center text-sm leading-5 text-link hover:underline"
                >Аккаунт&nbsp;→</RouterLink
              >
              <RouterLink
                to="/settings"
                class="flex size-11 items-center justify-center text-ink hover:bg-segment"
                :class="settingsCurrent ? 'rounded-lg bg-nav-selected' : 'rounded-full'"
                :aria-current="settingsCurrent ? 'page' : undefined"
                aria-label="Настройки"
                title="Настройки"
              >
                <UiGlyph name="cog" class="size-5" />
              </RouterLink>
              <span class="h-5 w-px bg-[#ccccd1]" aria-hidden="true" />
              <LogoutButton
                variant="plain"
                class="h-11! w-16! px-0! text-[#4d5159]! hover:text-ink!"
                @logged-out="(result) => emit('loggedOut', result)"
              />
            </div>
          </div>
        </div>
        <div v-if="!radarContext && transportWarning">
          <RealtimeBadge />
        </div>
        <slot />
      </main>
    </div>
  </div>

  <UiDialog v-model:open="menuOpen" title="Меню" size="drawer">
    <template #header>
      <p class="flex h-8 items-center gap-2 text-xl leading-7 font-semibold text-ink">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
    </template>
    <div class="flex min-h-full flex-col justify-between gap-6 bg-panel px-4 pt-4 pb-6">
      <RadarNav size="drawer" @navigate="menuOpen = false" />
      <WorkspaceSwitcher variant="card" @switched="onSwitched" />
    </div>
  </UiDialog>
</template>
