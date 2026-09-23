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

withDefaults(defineProps<{ variant?: 'secondary' | 'ghost'; block?: boolean }>(), {
  variant: 'ghost',
  block: false,
})

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
    emit('loggedOut', result)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UiButton :variant="variant" size="sm" :block="block" :loading="pending" @click="onClick"
    >Выйти</UiButton
  >
</template>
