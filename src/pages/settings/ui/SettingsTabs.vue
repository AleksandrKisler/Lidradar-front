<script setup lang="ts">
/**
 * Разделы настроек (Figma «Настройки»): на десктопе шесть равных вкладок, активная — белая плитка;
 * на планшете и телефоне — подписанный выбор раздела. Разделы организации доступны владельцу,
 * уведомления — любому активному участнику, поэтому список строится по правам роли.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { UiSelect } from '@/shared/ui'
import { useSessionStore, type Permission } from '@/entities/session'

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
</script>

<template>
  <div>
    <nav aria-label="Разделы настроек" class="hidden lg:block">
      <ul class="grid grid-flow-col auto-cols-fr">
        <li v-for="tab in tabs" :key="tab.label">
          <RouterLink v-slot="{ href, navigate, isExactActive }" :to="tab.to" custom>
            <a
              :href="href"
              :aria-current="isExactActive ? 'page' : undefined"
              :class="[
                'flex h-[46px] w-[calc(100%-8px)] items-center justify-center rounded-control text-sm leading-5',
                isExactActive ? 'bg-paper font-medium text-ink' : 'text-secondary hover:text-ink',
              ]"
              @click="navigate"
            >
              {{ tab.label }}
            </a>
          </RouterLink>
        </li>
      </ul>
    </nav>
    <div class="flex flex-col gap-2 lg:hidden">
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
