<script setup lang="ts">
/**
 * Время загрузки снимка и ручное обновление: фонового опроса у admin-экранов
 * нет, чтобы скрытая вкладка не создавала нагрузку.
 */
import { formatDateTime } from '@/shared/lib'
import { UiButton } from '@/shared/ui'

defineProps<{ updatedAt: number; loading: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
    <span v-if="updatedAt" data-testid="snapshot-time">
      Снимок на {{ formatDateTime(new Date(updatedAt).toISOString(), 'UTC') }} UTC
    </span>
    <span v-else>Снимок ещё не загружен</span>
    <UiButton size="sm" variant="secondary" :loading="loading" @click="emit('refresh')">
      Обновить
    </UiButton>
  </div>
</template>
