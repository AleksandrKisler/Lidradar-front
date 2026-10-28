<script setup lang="ts">
/**
 * Layout для авторизованного пользователя без выбранной организации:
 * выбор пространства, приглашение и создание организации. Бокового меню нет —
 * данных организации ещё нет. Шапка по макетам «Рабочие пространства»:
 * бренд слева, справа имя, «Аккаунт» и «Выйти». `loading` — первая загрузка:
 * сессия ещё неизвестна, остаётся только бренд.
 */
import { UiIcon } from '@/shared/ui'
import { RouterLink, useRouter } from 'vue-router'
import { computed } from 'vue'
import { useSessionStore } from '@/entities/session'
import { useAdminMeQuery } from '@/entities/admin'
import { AccountDeletionBanner, LogoutButton } from '@/features/auth-session'

const props = defineProps<{ loading?: boolean }>()

const session = useSessionStore()
const router = useRouter()
// Пока сессия неизвестна (каркас первой загрузки), право администратора не запрашивается.
const adminMe = useAdminMeQuery(() => !props.loading)
const isPlatformAdmin = computed(() => adminMe.data.value?.platformAdmin === true)

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}
</script>

<template>
  <div class="min-h-dvh">
    <header class="flex h-20 items-center justify-between gap-4 px-4 md:px-8 lg:px-12">
      <p class="flex items-center gap-2.5 text-xl leading-7 font-semibold text-ink">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
      <div v-if="!loading" class="flex items-center gap-6 text-sm leading-5">
        <RouterLink
          v-if="isPlatformAdmin"
          :to="{ name: 'admin-overview' }"
          class="text-link hover:underline"
        >
          Администрирование
        </RouterLink>
        <p class="hidden text-secondary md:block">{{ session.user?.displayName }}</p>
        <RouterLink
          :to="{ name: 'account' }"
          class="text-link hover:underline"
          data-testid="account-link"
        >
          Аккаунт
        </RouterLink>
        <span class="hidden h-4 w-px bg-line md:block" aria-hidden="true" />
        <LogoutButton variant="plain" size="sm" class="md:-ml-2.5" @logged-out="onLoggedOut" />
      </div>
    </header>
    <AccountDeletionBanner v-if="!loading" />
    <main id="main" class="mx-auto w-full max-w-[760px] px-4 pt-10 pb-10 md:px-0 md:pt-[129px]">
      <slot><RouterView /></slot>
    </main>
  </div>
</template>
