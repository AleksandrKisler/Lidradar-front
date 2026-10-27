<script setup lang="ts">
/**
 * Навигация по разделам (Figma 21:1983): пункт 44 px с иконкой, выбранный —
 * на светло-синей подложке; текущий раздел объявляется через `aria-current`.
 * `group` выбирает основные разделы или нижнюю группу («Настройки»).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { UiGlyph } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { visibleNavItems } from '../model/navigation'

const props = withDefaults(defineProps<{ group?: 'main' | 'bottom' }>(), { group: 'main' })
const emit = defineEmits<{ navigate: [] }>()

const session = useSessionStore()
const route = useRoute()
/** Карточка риска принадлежит разделу Radar: пункт остаётся выбранным (Figma 199:11280). */
const isCurrent = (to: string, linkActive: boolean) =>
  linkActive || (to === '/radar' && route.name === 'risk')
const items = computed(() =>
  visibleNavItems((permission) => session.can(permission)).filter(
    (item) => item.group === props.group,
  ),
)
</script>

<template>
  <nav :aria-label="group === 'main' ? 'Разделы' : 'Настройки'">
    <ul class="flex flex-col gap-1">
      <li v-for="item in items" :key="item.to">
        <RouterLink v-slot="{ href, navigate, isActive }" :to="item.to" custom>
          <a
            :href="href"
            :aria-current="isCurrent(item.to, isActive) ? 'page' : undefined"
            :class="[
              'flex h-11 items-center rounded-button pl-2.5 text-sm font-medium transition-colors',
              group === 'main' ? 'gap-1.5' : 'gap-2',
              isCurrent(item.to, isActive)
                ? 'bg-nav-selected text-link'
                : 'text-ink hover:bg-segment',
            ]"
            @click="
              (event) => {
                navigate(event)
                emit('navigate')
              }
            "
          >
            <span
              v-if="group === 'main'"
              :class="[
                'flex size-[18px] items-center justify-center',
                isCurrent(item.to, isActive) ? '' : 'text-secondary',
              ]"
            >
              <UiGlyph :name="item.icon" class="size-[19.4px]" />
            </span>
            <UiGlyph v-else :name="item.icon" class="size-5" />
            <span :class="group === 'main' ? 'px-3' : ''">{{ item.label }}</span>
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
