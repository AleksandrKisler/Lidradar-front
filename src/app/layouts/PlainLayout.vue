<script setup lang="ts">
/**
 * Layout для авторизованного пользователя без выбранной организации:
 * выбор пространства и создание организации. Бокового меню нет — данных
 * организации ещё нет.
 */
import { RouterLink, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useSessionStore } from '@/entities/session'
import { useAdminMeQuery } from '@/entities/admin'
import { LogoutButton } from '@/features/auth-session'

const session = useSessionStore()
const router = useRouter()
const adminMe = useAdminMeQuery()
const isPlatformAdmin = computed(() => adminMe.data.value?.platformAdmin === true)

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3 md:px-12"
    >
      <p class="text-lg font-bold tracking-tight text-ink">◉ LidRadar</p>
      <div class="flex items-center gap-3">
        <RouterLink
          v-if="isPlatformAdmin"
          :to="{ name: 'admin-overview' }"
          class="text-sm font-semibold text-brand-dark hover:underline"
        >
          Администрирование
        </RouterLink>
        <p class="hidden text-sm text-muted sm:block">{{ session.user?.displayName }}</p>
        <LogoutButton variant="secondary" @logged-out="onLoggedOut" />
      </div>
    </header>
    <main id="main" class="mx-auto w-full max-w-xl px-5 py-10 md:px-12">
      <RouterView />
    </main>
  </div>
</template>
