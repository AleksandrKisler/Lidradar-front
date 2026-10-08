<script setup lang="ts">
/** Навигация по разделам; текущий раздел объявляется через `aria-current`. */
import { computed } from 'vue'
import { useSessionStore } from '@/entities/session'
import { visibleNavItems } from '../model/navigation'

const emit = defineEmits<{ navigate: [] }>()

const session = useSessionStore()
const items = computed(() => visibleNavItems((permission) => session.can(permission)))
</script>

<template>
  <nav aria-label="Разделы">
    <ul class="flex flex-col gap-1">
      <li v-for="item in items" :key="item.to">
        <RouterLink v-slot="{ href, navigate, isActive }" :to="item.to" custom>
          <a
            :href="href"
            :aria-current="isActive ? 'page' : undefined"
            :class="[
              'block rounded-full px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'bg-nav-active text-white'
                : 'text-nav-text hover:bg-nav-active/60 hover:text-white',
            ]"
            @click="
              (event) => {
                navigate(event)
                emit('navigate')
              }
            "
          >
            {{ item.label }}
          </a>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
