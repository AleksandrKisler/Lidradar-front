<script setup lang="ts">
/**
 * Вкладки настроек. Разделы организации доступны владельцу, уведомления —
 * любому активному участнику, поэтому список строится по правам роли.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSessionStore, type Permission } from '@/entities/session'

const session = useSessionStore()

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
]
const tabs = computed(() =>
  allTabs.filter((tab) => tab.permission === null || session.can(tab.permission)),
)
</script>

<template>
  <nav aria-label="Разделы настроек" class="border-b border-line">
    <ul class="flex flex-wrap gap-6">
      <li v-for="tab in tabs" :key="tab.label">
        <RouterLink v-slot="{ href, navigate, isExactActive }" :to="tab.to" custom>
          <a
            :href="href"
            :aria-current="isExactActive ? 'page' : undefined"
            :class="[
              '-mb-px inline-block border-b-2 py-3 text-sm font-semibold',
              isExactActive
                ? 'border-brand text-brand-dark'
                : 'border-transparent text-muted hover:text-ink',
            ]"
            @click="navigate"
          >
            {{ tab.label }}
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
