<script setup lang="ts">
/** Exact channel vectors as cacheable assets. */
import telegram from './assets/channel-telegram.svg?no-inline'
import max from './assets/channel-max.svg?no-inline'
defineProps<{ kind: 'telegram' | 'max' }>()
</script>
<template>
  <img
    :src="kind === 'telegram' ? telegram : max"
    class="size-10 shrink-0"
    width="40"
    height="40"
    alt=""
    aria-hidden="true"
  />
</template>
