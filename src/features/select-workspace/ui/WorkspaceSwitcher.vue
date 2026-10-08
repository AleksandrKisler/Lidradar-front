<script setup lang="ts">
/**
 * Переключатель организации в боковом меню. При одном членстве показывает
 * название без элемента управления; при нескольких — нативный список,
 * доступный с клавиатуры.
 */
import { computed } from 'vue'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '../model/use-switch-workspace'

const emit = defineEmits<{ switched: [tenantId: string] }>()

const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()

const current = computed(() => session.membership)
const multiple = computed(() => session.memberships.length > 1)

async function onChange(event: Event): Promise<void> {
  const tenantId = (event.target as HTMLSelectElement).value
  if (tenantId && (await switchTo(tenantId))) emit('switched', tenantId)
}
</script>

<template>
  <div>
    <p class="text-xs font-semibold tracking-wide text-nav-text/70">Рабочее пространство</p>
    <template v-if="multiple">
      <select
        class="mt-2 h-10 w-full rounded-field border border-nav-active bg-nav-active px-3 text-sm font-semibold text-white"
        aria-label="Рабочее пространство"
        :value="session.tenantId ?? ''"
        @change="onChange"
      >
        <option v-for="item in session.memberships" :key="item.tenantId" :value="item.tenantId">
          {{ item.organizationName }} · {{ roleLabel(item.role) }}
        </option>
      </select>
    </template>
    <template v-else-if="current">
      <p class="mt-2 font-semibold break-words text-white">{{ current.organizationName }}</p>
      <p class="text-sm text-nav-text">{{ roleLabel(current.role) }}</p>
    </template>
  </div>
</template>
