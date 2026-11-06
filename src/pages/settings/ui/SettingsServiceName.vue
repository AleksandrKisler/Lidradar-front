<script setup lang="ts">
import { UiTooltip } from '@/shared/ui'
defineProps<{ name: string }>()
</script>
<template>
  <UiTooltip :text="name" class="w-full min-w-0">
    <template #default="{ describedBy }">
      <button
        type="button"
        class="line-clamp-2 w-full break-words text-left text-base leading-[22px] font-semibold text-ink"
        :aria-label="`Полное название услуги «${name}»`"
        :aria-describedby="describedBy"
      >
        {{ name }}
      </button>
    </template>
  </UiTooltip>
</template>
