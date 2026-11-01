<script setup lang="ts">
import type { TeamRole } from '../model/types'
defineProps<{ disabled?: boolean; name?: string }>()
const role = defineModel<TeamRole>({ default: 'MANAGER' })
const roles: TeamRole[] = ['MANAGER', 'OWNER']
const descriptions = {
  MANAGER: [
    'Работает с рисками и диалогами, фиксирует действия, результаты и оплаты. ',
    'Не управляет командой и компанией.',
  ],
  OWNER: [
    'Управляет компанией, командой, интеграциями и данными. Работает с ',
    'рисками и видит аналитику.',
  ],
}
</script>
<template>
  <fieldset class="flex min-w-0 flex-col gap-3" :disabled="disabled">
    <legend class="mb-3 text-sm leading-5 text-ink">Роль участника</legend>
    <label
      v-for="value in roles"
      :key="value"
      class="team-role-choice relative flex cursor-pointer flex-col gap-1.5 rounded-field p-4 text-sm leading-5"
      :style="disabled ? { opacity: 0.65 } : undefined"
      :class="
        disabled
          ? 'border border-line'
          : role === value
            ? 'border-2 border-link'
            : 'border border-line'
      "
    >
      <input
        v-model="role"
        type="radio"
        :name="name ?? 'role'"
        :value="value"
        class="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span class="text-base leading-[22px] font-semibold text-ink"
        >{{ role === value ? '✓' : '○' }} {{ value === 'OWNER' ? 'Владелец' : 'Менеджер' }}</span
      >
      <span class="text-muted"
        >{{ descriptions[value][0] }}<br class="hidden md:block" />{{
          descriptions[value][1]
        }}</span
      >
    </label>
  </fieldset>
</template>

<style scoped>
.team-role-choice:has(:focus-visible) {
  outline: 2px solid var(--color-link);
  outline-offset: 2px;
}
</style>
