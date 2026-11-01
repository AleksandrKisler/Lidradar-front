<script setup lang="ts">
/**
 * Layout рабочего пространства. Проверяет право маршрута: без него вместо
 * страницы показывается нейтральное «Раздел недоступен» с тем же адресом,
 * чтобы прямой переход не раскрывал ничего лишнего. Смена организации
 * возвращает в Radar без фильтров — точки другой организации иные.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiAccessDenied } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { AppShell } from '@/widgets/app-shell'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()

const denied = computed(
  () => route.meta.permission !== undefined && !session.can(route.meta.permission),
)

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}

function onWorkspaceSwitched(): void {
  void router.replace({ name: 'radar' })
}
</script>

<template>
  <AppShell @logged-out="onLoggedOut" @workspace-switched="onWorkspaceSwitched">
    <UiAccessDenied
      v-if="denied && route.name !== 'settings-team'"
      back-label="Вернуться в Radar"
      @back="router.push({ name: 'radar' })"
    />
    <!-- R54 Team owns a read-only denied view; its queries/actions are gated by member.manage. -->
    <RouterView v-else />
  </AppShell>
</template>
