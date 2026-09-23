<script setup lang="ts">
/**
 * Список рабочих пространств для явного выбора при двух и более членствах.
 * Принимает только идентификаторы из `/auth/me`; длинные названия переносятся.
 */
import { ref } from 'vue'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '../model/use-switch-workspace'

const emit = defineEmits<{ selected: [tenantId: string] }>()

const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()
const pendingId = ref<string | null>(null)

async function choose(tenantId: string): Promise<void> {
  if (pendingId.value) return
  pendingId.value = tenantId
  try {
    if (await switchTo(tenantId)) emit('selected', tenantId)
  } finally {
    pendingId.value = null
  }
}
</script>

<template>
  <ul class="flex flex-col gap-3" aria-label="Рабочие пространства">
    <li v-for="item in session.memberships" :key="item.tenantId">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-4 rounded-control border border-line bg-paper px-5 py-4 text-left hover:border-brand hover:bg-brand-pale/40 disabled:cursor-wait"
        :aria-current="item.tenantId === session.tenantId ? 'true' : undefined"
        :disabled="pendingId !== null"
        @click="choose(item.tenantId)"
      >
        <span class="min-w-0">
          <span class="block font-semibold break-words text-ink">{{ item.organizationName }}</span>
          <span class="mt-0.5 block text-sm text-muted">{{ roleLabel(item.role) }}</span>
        </span>
        <span
          v-if="item.tenantId === session.tenantId"
          class="shrink-0 text-xs font-semibold text-brand"
          >Текущее</span
        >
      </button>
    </li>
  </ul>
</template>
