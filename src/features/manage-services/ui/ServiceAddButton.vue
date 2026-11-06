<script setup lang="ts">
import add from './assets/service-add.svg?no-inline'
</script>
<template>
  <button
    type="button"
    aria-label="Добавить услугу"
    class="flex size-11 shrink-0 items-center justify-center rounded-field lg:size-7"
  >
    <img :src="add" width="20" height="20" alt="" />
  </button>
</template>
