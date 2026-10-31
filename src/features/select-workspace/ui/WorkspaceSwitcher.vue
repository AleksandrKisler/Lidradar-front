<script setup lang="ts">
/**
 * Переключатель организации в боковом меню. При одном членстве показывает
 * название без элемента управления; при нескольких — нативный список,
 * доступный с клавиатуры.
 *
 * `variant` меняет только вид: `sidebar` — закреплённый блок внизу боковой колонки Radar
 * (Figma 27:2771), `card` — белая карточка внизу меню планшета и телефона (630:8291 / 630:8375).
 * Длинное название переносится, а не обрезается; переключение — тот же контроллер.
 * На панели колонки (#f0f0f3) серый muted даёт 4,45:1 — подписи там `secondary` ради AA.
 */
import { computed } from 'vue'
import { plural } from '@/shared/lib'
import { useLocationsQuery } from '@/entities/location'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '../model/use-switch-workspace'

const props = withDefaults(defineProps<{ variant?: 'default' | 'sidebar' | 'card' }>(), {
  variant: 'default',
})
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
const compact = computed(() => props.variant !== 'default')

async function onChange(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  select.focus()
  const tenantId = select.value
  if (tenantId && (await switchTo(tenantId))) emit('switched', tenantId)
  else select.value = session.tenantId ?? ''
}
</script>

<template>
  <div
    v-if="compact"
    :class="['flex min-w-0 flex-col gap-1', variant === 'card' ? 'rounded-xl bg-paper p-3' : '']"
  >
    <select
      v-if="multiple"
      :class="[
        'w-full min-w-0 truncate rounded-field border border-line bg-paper pr-8 pl-3 font-medium text-ink',
        variant === 'card' ? 'h-11 text-note' : 'h-10 text-sm',
      ]"
      aria-label="Рабочее пространство"
      :value="session.tenantId ?? ''"
      @change="onChange"
    >
      <option v-for="item in session.memberships" :key="item.tenantId" :value="item.tenantId">
        {{ item.organizationName }} · {{ roleLabel(item.role) }}
      </option>
    </select>
    <div v-else-if="current" class="flex min-w-0 items-start justify-between gap-3">
      <p
        :class="[
          'min-w-0 font-medium break-words text-ink',
          variant === 'card' ? 'text-note leading-[22px]' : 'text-sm leading-5',
        ]"
      >
        {{ current.organizationName }}
      </p>
      <p
        v-if="locationsLabel"
        :class="[
          'shrink-0',
          variant === 'card'
            ? 'pt-0.5 text-meta leading-[18px] text-muted'
            : 'pt-px text-xs leading-[18px] text-secondary',
        ]"
      >
        {{ locationsLabel }}
      </p>
    </div>
    <div class="flex items-center justify-between gap-3">
      <p
        :class="
          variant === 'card'
            ? 'text-meta leading-[18px] text-muted'
            : 'text-xs leading-[18px] text-secondary'
        "
      >
        Рабочее пространство
      </p>
      <p
        v-if="multiple && locationsLabel"
        :class="[
          'shrink-0',
          variant === 'card'
            ? 'text-meta leading-[18px] text-muted'
            : 'text-xs leading-[18px] text-secondary',
        ]"
      >
        {{ locationsLabel }}
      </p>
    </div>
  </div>
  <div v-else class="flex flex-col gap-1">
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
