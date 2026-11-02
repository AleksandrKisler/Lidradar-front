<script setup lang="ts">
/**
 * Разделы настроек (Figma «Настройки»): на десктопе шесть равных вкладок, активная — белая плитка;
 * на планшете и телефоне — подписанный выбор раздела. Разделы организации доступны владельцу,
 * уведомления — любому активному участнику, поэтому список строится по правам роли.
 */
import { computed, nextTick, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { UiSelect } from '@/shared/ui'
import { useSessionStore, type Permission } from '@/entities/session'

const props = defineProps<{
  scrolling?: boolean
  mobileScrollOffset?: number | undefined
  desktopPrivacy?: boolean
}>()
const strip = ref<HTMLElement>()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const allTabs: { to: { name: string }; label: string; permission: Permission | null }[] = [
  {
    to: { name: 'settings-company' },
    label: 'Компания и график',
    permission: 'organization.manage',
  },
  { to: { name: 'settings-services' }, label: 'Услуги', permission: 'service.manage' },
  { to: { name: 'settings-notifications' }, label: 'Уведомления', permission: null },
  { to: { name: 'settings-team' }, label: 'Команда', permission: 'member.manage' },
  { to: { name: 'settings-privacy' }, label: 'Данные', permission: null },
  { to: { name: 'settings-account' }, label: 'Аккаунт', permission: null },
]
const tabs = computed(() =>
  allTabs.filter((tab) => tab.permission === null || session.can(tab.permission)),
)
const options = computed(() => tabs.value.map((tab) => ({ value: tab.to.name, label: tab.label })))
const current = computed(() => String(route.name ?? ''))
async function positionActive() {
  if (!strip.value) return
  await nextTick()
  if (!strip.value) return
  if (props.desktopPrivacy && props.scrolling) {
    const active = strip.value.querySelector<HTMLElement>('[aria-current="page"]')
    strip.value.scrollLeft = Math.min(
      strip.value.scrollWidth - strip.value.clientWidth,
      active ? active.offsetLeft - strip.value.offsetLeft : Infinity,
    )
    return
  }
  if (props.mobileScrollOffset === undefined) return
  const active = strip.value.querySelector<HTMLElement>('[aria-current="page"]')
  strip.value.scrollLeft =
    window.innerWidth < 768 && active
      ? Math.min(props.mobileScrollOffset, active.offsetLeft - strip.value.offsetLeft)
      : 0
}
onMounted(() => {
  void positionActive()
  window.addEventListener('resize', positionActive)
})
onBeforeUnmount(() => window.removeEventListener('resize', positionActive))
watch(() => [current.value, props.scrolling], positionActive)

const selectKey = ref(0)
async function open(name: string | undefined): Promise<void> {
  if (!name || name === current.value) return
  await router.push({ name })
  // Переход отменён (несохранённый график): список снова показывает текущий раздел.
  if (String(route.name ?? '') !== name) {
    selectKey.value += 1
    await nextTick()
    document.getElementById('settings-section')?.focus()
  }
}
function moveFocus(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const links = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>('a')]
  const index = links.indexOf(document.activeElement as HTMLAnchorElement)
  if (index < 0) return
  event.preventDefault()
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? links.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length
  links[next]?.focus()
}
</script>

<template>
  <div :class="desktopPrivacy ? 'min-w-0' : undefined">
    <nav
      ref="strip"
      aria-label="Разделы настроек"
      :class="scrolling ? 'settings-tabs min-w-0 overflow-x-auto' : 'hidden lg:block'"
      @keydown="moveFocus"
    >
      <ul
        :style="
          scrolling
            ? {
                minWidth: desktopPrivacy
                  ? 'var(--privacy-tabs, 1120px)'
                  : `${tabs.length * 188 - 8}px`,
              }
            : undefined
        "
        :class="
          scrolling || desktopPrivacy
            ? 'grid grid-flow-col auto-cols-fr gap-2'
            : 'grid grid-flow-col auto-cols-fr'
        "
      >
        <li v-for="tab in desktopPrivacy ? allTabs : tabs" :key="tab.label">
          <RouterLink
            v-if="tab.permission === null || session.can(tab.permission)"
            v-slot="{ href, navigate, isExactActive }"
            :to="tab.to"
            custom
          >
            <a
              :href="href"
              :style="desktopPrivacy && scrolling ? { outlineOffset: '-2px' } : undefined"
              :aria-current="isExactActive ? 'page' : undefined"
              :class="[
                'flex h-[46px] items-center justify-center rounded-control text-sm leading-5',
                scrolling || desktopPrivacy ? 'w-full' : 'w-[calc(100%-8px)]',
                desktopPrivacy ? 'font-medium' : '',
                isExactActive
                  ? 'bg-paper font-medium text-ink'
                  : desktopPrivacy
                    ? 'text-muted hover:text-ink'
                    : 'text-secondary hover:text-ink',
              ]"
              @click="navigate"
            >
              {{ tab.label }}
            </a>
          </RouterLink>
          <span
            v-else
            role="link"
            aria-disabled="true"
            title="Раздел недоступен в текущей роли"
            class="flex h-[46px] items-center justify-center rounded-control text-sm leading-5 font-medium text-muted"
            >{{ tab.label }}</span
          >
        </li>
      </ul>
    </nav>
    <div v-if="!scrolling" class="flex flex-col gap-2 lg:hidden">
      <label for="settings-section" class="text-base leading-6 text-ink">Раздел настроек</label>
      <UiSelect
        id="settings-section"
        :key="selectKey"
        :model-value="current"
        :options="options"
        @update:model-value="open"
      />
    </div>
  </div>
</template>

<style>
.settings-tabs {
  scrollbar-width: none;
}
.settings-tabs::-webkit-scrollbar {
  display: none;
}
</style>
