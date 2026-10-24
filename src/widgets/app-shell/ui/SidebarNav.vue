<script setup lang="ts">
/** Навигация по разделам; текущий раздел объявляется через `aria-current`. */
import { computed } from 'vue'
import { useSessionStore } from '@/entities/session'
import { visibleNavItems } from '../model/navigation'

const emit = defineEmits<{ navigate: [] }>()

const session = useSessionStore()
const items = computed(() =>
  visibleNavItems((permission) => session.can(permission), { sandbox: session.sandbox }),
)
const mainItems = computed(() => items.value.filter((item) => !item.sandbox))
const stagingItems = computed(() => items.value.filter((item) => item.sandbox))
</script>

<template>
  <nav aria-label="Разделы">
    <ul class="flex flex-col gap-1">
      <li v-for="item in mainItems" :key="item.to">
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
    <template v-if="stagingItems.length">
      <div class="mx-4 my-3 h-px bg-nav-active" role="separator" />
      <ul class="flex flex-col gap-1" aria-label="Инструменты стейджа">
        <li v-for="item in stagingItems" :key="item.to">
          <RouterLink v-slot="{ href, navigate, isActive }" :to="item.to" custom>
            <a
              :href="href"
              :aria-current="isActive ? 'page' : undefined"
              :class="[
                'flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-colors',
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
              <span
                class="ml-auto rounded-full bg-warning-pale px-2 py-0.5 text-xs font-semibold text-warning"
                >стейдж</span
              >
            </a>
          </RouterLink>
        </li>
      </ul>
    </template>
  </nav>
</template>
