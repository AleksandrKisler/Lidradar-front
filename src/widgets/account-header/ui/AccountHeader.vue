<script setup lang="ts">
/**
 * Шапка страниц без боковой панели («Рабочие пространства», «Принять приглашение», «Начало работы»):
 * бренд слева, справа имя, «Аккаунт» и «Выйти». `loading` — первая загрузка: сессия ещё неизвестна,
 * остаётся только бренд, а право администратора не запрашивается.
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { UiIcon } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { useAdminMeQuery } from '@/entities/admin'
import { LogoutButton } from '@/features/auth-session'

const props = defineProps<{ loading?: boolean }>()

const session = useSessionStore()
const router = useRouter()
const adminMe = useAdminMeQuery(() => !props.loading)
const isPlatformAdmin = computed(() => adminMe.data.value?.platformAdmin === true)

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}
</script>

<template>
  <header class="flex min-h-20 items-center justify-between gap-4 px-4 py-3 md:px-8 lg:px-12">
    <p class="flex shrink-0 items-center gap-2.5 text-xl leading-7 font-semibold text-ink">
      <UiIcon name="radar" class="size-7" />LidRadar
    </p>
    <div
      v-if="!loading"
      class="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm leading-5 md:gap-6"
    >
      <RouterLink
        v-if="isPlatformAdmin"
        :to="{ name: 'admin-overview' }"
        class="text-link hover:underline"
      >
        Администрирование
      </RouterLink>
      <p
        class="w-full text-right break-words text-secondary md:w-auto md:max-w-64"
        data-testid="account-display-name"
      >
        {{ session.user?.displayName }}
      </p>
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
</template>
