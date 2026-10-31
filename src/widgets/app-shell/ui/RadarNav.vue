<script setup lang="ts">
/**
 * Разделы оболочки Radar C: единая белая панель с тонкими разделителями и мягким
 * выделением текущего раздела (Figma 27:2776; меню 630:8296 / 630:8380). `drawer` — строки
 * 52 px и подписи 17/24 для меню планшета и телефона, иначе — 44 px и 14/20.
 * Видимость пунктов — прежние права; «Настройки» живут в шапке.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { UiGlyph } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { isSectionCurrent, visibleNavItems } from '../model/navigation'

const props = withDefaults(defineProps<{ size?: 'sidebar' | 'drawer' }>(), { size: 'sidebar' })
const emit = defineEmits<{ navigate: [] }>()

const session = useSessionStore()
const route = useRoute()
const items = computed(() =>
  visibleNavItems((permission) => session.can(permission), session.sandboxEnabled).filter(
    (item) => item.group === 'main',
  ),
)
const drawer = computed(() => props.size === 'drawer')
</script>

<template>
  <nav aria-label="Разделы" class="w-full rounded-[14px] bg-paper p-2">
    <ul class="flex flex-col gap-[3px]">
      <li v-for="(item, index) in items" :key="item.to" class="flex flex-col gap-[3px]">
        <span v-if="index > 0" class="mx-3 h-px bg-line" aria-hidden="true" />
        <RouterLink v-slot="{ href, navigate, isActive }" :to="item.to" custom>
          <a
            :href="href"
            :aria-current="isSectionCurrent(item.to, isActive, route.name) ? 'page' : undefined"
            :class="[
              'flex items-center gap-1.5 rounded-lg px-2.5 text-ink transition-colors',
              drawer ? 'min-h-13 py-1 text-[17px] leading-6' : 'min-h-11 py-0.5 text-sm leading-5',
              isSectionCurrent(item.to, isActive, route.name)
                ? 'bg-nav-selected font-semibold'
                : 'font-medium hover:bg-segment',
            ]"
            @click="
              (event) => {
                navigate(event)
                emit('navigate')
              }
            "
          >
            <UiGlyph
              :name="item.icon"
              :class="[
                drawer ? 'size-[22px]' : 'size-[18px]',
                isSectionCurrent(item.to, isActive, route.name) ? 'text-brand' : 'text-secondary',
              ]"
            />
            <span class="min-w-0 px-3 break-words">{{ item.label }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
