<script setup lang="ts">
/**
 * Заголовок, пояснение и вкладки страницы настроек. Контекст «Организация / Настройки»
 * выводит общая оболочка C, поэтому локальный page head его не повторяет.
 */
import SettingsTabs from './SettingsTabs.vue'

defineProps<{ title: string; subtitle: string }>()
</script>

<template>
  <div class="flex flex-col gap-6">
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
