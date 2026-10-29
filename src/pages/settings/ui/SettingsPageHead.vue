<script setup lang="ts">
/**
 * Шапка страницы настроек v2 (Figma «Настройки»): контекст «Организация / Настройки», заголовок
 * раздела, пояснение и вкладки. Страницы раздела сами рисуют заголовок, поэтому маршруту нужен `meta.v2`.
 */
import { computed } from 'vue'
import { useSessionStore } from '@/entities/session'
import SettingsTabs from './SettingsTabs.vue'

defineProps<{ title: string; subtitle: string }>()

const session = useSessionStore()
const organizationName = computed(() => session.membership?.organizationName ?? '')
</script>

<template>
  <div class="flex flex-col gap-6">
    <p class="text-xs leading-[18px] text-muted lg:h-5">
      {{ organizationName }}&nbsp;&nbsp;/&nbsp;&nbsp;Настройки
    </p>
    <header class="flex flex-col gap-1.5">
      <h1
        tabindex="-1"
        class="text-[28px] leading-[34px] font-semibold text-ink focus:outline-none md:text-[32px] md:leading-10"
      >
        {{ title }}
      </h1>
      <p
        class="text-sm leading-5 text-muted md:text-[15px] md:leading-[22px] lg:text-sm lg:leading-5"
      >
        {{ subtitle }}
      </p>
    </header>
    <SettingsTabs />
  </div>
</template>
