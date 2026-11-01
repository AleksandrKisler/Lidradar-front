<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UiGlyph from './UiGlyph.vue'
defineProps<{ title: string; message: string; editLabel: string; contentWidth?: number }>()
defineEmits<{ ok: []; edit: [] }>()
const ok = ref<HTMLButtonElement>()
onMounted(() => ok.value?.focus())
</script>
<template>
  <div class="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-center">
    <div
      class="flex w-full flex-col items-center gap-4"
      :style="{ maxWidth: contentWidth ? `${contentWidth}px` : undefined }"
      role="status"
    >
      <span class="flex size-16 items-center justify-center rounded-full bg-success-pale"
        ><UiGlyph name="location-success" class="size-8 text-success"
      /></span>
      <h2 class="text-xl leading-7 font-semibold text-ink">{{ title }}</h2>
      <p class="break-words text-sm leading-5 text-muted">{{ message }}</p>
    </div>
    <div class="flex items-center justify-center gap-6">
      <button ref="ok" type="button" class="h-[46px] px-3 text-sm text-link" @click="$emit('ok')">
        ОК
      </button>
      <button type="button" class="h-[46px] px-3 text-sm text-link" @click="$emit('edit')">
        {{ editLabel }}
      </button>
    </div>
  </div>
</template>
