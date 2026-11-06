<script setup lang="ts">
import plus from './assets/plus.svg?no-inline'
import pencil from './assets/pencil.svg?no-inline'
import trash from './assets/trash.svg?no-inline'
defineProps<{ name: 'plus' | 'pencil' | 'trash' }>()
const icons = { plus, pencil, trash }
</script>
<template>
  <span class="relative inline-flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
    <img :src="icons[name]" alt="" />
  </span>
</template>
