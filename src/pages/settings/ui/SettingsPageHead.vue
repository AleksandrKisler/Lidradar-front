<script setup lang="ts">
/**
 * Заголовок, пояснение и вкладки страницы настроек. Контекст «Организация / Настройки»
 * выводит общая оболочка C, поэтому локальный page head его не повторяет.
 */
import SettingsTabs from './SettingsTabs.vue'

defineProps<{ title: string; subtitle: string; scrollingTabs?: boolean }>()
</script>

<template>
  <div class="flex flex-col" :class="scrollingTabs ? 'gap-5 md:gap-6' : 'gap-6'">
    <header class="flex flex-col" :class="scrollingTabs ? 'gap-2' : 'gap-1.5'">
      <div class="flex items-center gap-2">
        <h1
          tabindex="-1"
          class="min-w-0 flex-1 text-[28px] leading-[34px] font-semibold text-ink focus:outline-none md:text-[32px] md:leading-10"
        >
          {{ title }}
        </h1>
        <slot name="action" />
      </div>
      <p
        class="text-sm leading-5 text-muted"
        :class="scrollingTabs ? '' : 'md:text-[15px] md:leading-[22px] lg:text-sm lg:leading-5'"
      >
        {{ subtitle }}
      </p>
    </header>
    <SettingsTabs :scrolling="scrollingTabs" />
  </div>
</template>
