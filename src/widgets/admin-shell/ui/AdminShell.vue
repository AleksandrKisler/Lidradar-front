<script setup lang="ts">
/**
 * Оболочка администрирования: отдельная навигация и тёмная шапка, чтобы
 * раздел визуально не смешивался с рабочим пространством. Данных
 * организации здесь нет — только сеанс.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSessionStore } from '@/entities/session'
import { LogoutButton } from '@/features/auth-session'
import { ADMIN_SECTIONS } from '../model/sections'

const emit = defineEmits<{ loggedOut: [result: { confirmed: boolean }] }>()
const session = useSessionStore()
const route = useRoute()
const title = computed(() => route.meta.title ?? 'Администрирование')
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-field focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
  >
    К основному содержимому
  </a>
  <div class="min-h-dvh md:grid md:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]">
    <aside class="flex flex-col gap-6 bg-nav p-5 text-white md:p-6">
      <div>
        <p class="text-xl font-bold tracking-tight">◉ LidRadar</p>
        <p class="mt-1 text-xs font-semibold tracking-wide text-brand-pale uppercase">
          Администрирование платформы
        </p>
      </div>
      <nav aria-label="Разделы администрирования">
        <ul class="flex flex-wrap gap-1 md:flex-col">
          <li v-for="section in ADMIN_SECTIONS" :key="section.name">
            <RouterLink
              v-slot="{ href, navigate, isExactActive }"
              :to="{ name: section.name }"
              custom
            >
              <a
                :href="href"
                :aria-current="isExactActive ? 'page' : undefined"
                :class="[
                  'block rounded-control px-3 py-2 text-sm font-semibold',
                  isExactActive ? 'bg-nav-active text-white' : 'text-nav-text hover:text-white',
                ]"
                @click="navigate"
              >
                {{ section.label }}
              </a>
            </RouterLink>
          </li>
        </ul>
      </nav>
      <div class="mt-auto border-t border-nav-active pt-5">
        <p class="truncate text-sm font-semibold text-white">{{ session.user?.displayName }}</p>
        <RouterLink
          :to="{ name: 'radar' }"
          class="mt-2 block text-sm font-semibold text-nav-text hover:text-white"
        >
          ← В рабочее пространство
        </RouterLink>
        <div class="mt-3">
          <LogoutButton
            variant="secondary"
            block
            @logged-out="(result) => emit('loggedOut', result)"
          />
        </div>
      </div>
    </aside>
    <div class="flex min-w-0 flex-col">
      <header class="border-b border-line bg-paper px-5 py-3 md:px-12">
        <p class="text-xs font-semibold tracking-wide text-muted uppercase">Только метаданные</p>
        <p class="truncate text-lg font-bold text-ink">{{ title }}</p>
      </header>
      <main id="main" class="flex-1 px-5 py-6 md:px-12 md:py-10">
        <slot />
      </main>
    </div>
  </div>
</template>
