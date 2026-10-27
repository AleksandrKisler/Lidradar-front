<script setup lang="ts">
/**
 * Переключатель организации в боковом меню. При одном членстве показывает
 * название без элемента управления; при нескольких — нативный список,
 * доступный с клавиатуры.
 */
import { computed } from 'vue'
import { plural } from '@/shared/lib'
import { useLocationsQuery } from '@/entities/location'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '../model/use-switch-workspace'

const emit = defineEmits<{ switched: [tenantId: string] }>()

const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()

const current = computed(() => session.membership)
const locations = useLocationsQuery(() => session.tenantId)
/** «N точек» только по успешно полученному списку; ошибка и загрузка — не ноль. */
const locationsLabel = computed(() => {
  const count = locations.data.value?.length
  return count === undefined ? null : `${count} ${plural(count, 'точка', 'точки', 'точек')}`
})
const multiple = computed(() => session.memberships.length > 1)

async function onChange(event: Event): Promise<void> {
  const tenantId = (event.target as HTMLSelectElement).value
  if (tenantId && (await switchTo(tenantId))) emit('switched', tenantId)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <p class="text-xs leading-[18px] text-secondary uppercase">Рабочее пространство</p>
    <template v-if="multiple">
      <select
        class="h-10 w-full rounded-field border border-line bg-paper px-3 text-sm font-medium text-ink"
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
      <p class="text-base leading-[22px] font-semibold break-words text-ink">
        {{ current.organizationName }}
      </p>
      <p class="text-xs leading-[18px] text-secondary">
        {{ locationsLabel ?? roleLabel(current.role) }}
      </p>
    </template>
  </div>
</template>
