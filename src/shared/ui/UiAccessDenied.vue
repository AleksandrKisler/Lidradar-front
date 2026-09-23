<script setup lang="ts">
/**
 * Состояние «Раздел недоступен» по листу состояний макета. Не раскрывает,
 * существует ли объект или чужая организация: только факт отсутствия доступа.
 */
import UiButton from './UiButton.vue'

withDefaults(
  defineProps<{
    title?: string | undefined
    description?: string | undefined
    /** Подпись кнопки возврата; кнопка скрыта, если подписи нет. */
    backLabel?: string | undefined
  }>(),
  {
    title: 'Раздел недоступен',
    description:
      'У вашей роли нет доступа к этим настройкам. Для изменения параметров обратитесь к владельцу рабочего пространства.',
    backLabel: '',
  },
)

const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <div
    role="status"
    class="mx-auto max-w-lg rounded-card border border-line bg-paper p-8 text-center"
  >
    <h1 class="text-2xl font-bold text-ink">{{ title }}</h1>
    <p class="mt-3 text-sm leading-6 text-muted">{{ description }}</p>
    <UiButton v-if="backLabel" class="mt-6" variant="secondary" @click="emit('back')">{{
      backLabel
    }}</UiButton>
  </div>
</template>
