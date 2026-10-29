<script setup lang="ts">
/**
 * Выход из системы. Кеш запросов очищается независимо от ответа сервера:
 * защищённые данные не должны пережить сессию на экране. Родитель получает
 * событие с признаком подтверждения и решает, куда перейти.
 */
import { ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { UiButton } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { clearInvitationContext } from '../model/invitation-context'

withDefaults(
  defineProps<{ variant?: 'secondary' | 'ghost' | 'plain'; block?: boolean; size?: 'sm' | 'md' }>(),
  { variant: 'ghost', block: false, size: 'sm' },
)

const emit = defineEmits<{ loggedOut: [result: { confirmed: boolean }] }>()

const session = useSessionStore()
const queryClient = useQueryClient()
const pending = ref(false)

async function onClick(): Promise<void> {
  if (pending.value) return
  pending.value = true
  try {
    const result = await session.logout()
    queryClient.clear()
    // Контекст проверенного приглашения вкладки не переживает выход (US-M01-01 AC-B14/B15).
    clearInvitationContext()
    emit('loggedOut', result)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UiButton :variant="variant" :size="size" :block="block" :loading="pending" @click="onClick"
    ><slot>Выйти</slot></UiButton
  >
</template>
