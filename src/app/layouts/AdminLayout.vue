<script setup lang="ts">
/**
 * Guard раздела администрирования: право проверяется запросом `/admin/me`
 * при входе. Отсутствие права показывает нейтральный экран без данных;
 * потеря права во время работы (перечитанный признак) закрывает оболочку.
 */
import { useRouter } from 'vue-router'
import { UiAccessDenied, UiErrorState, UiSkeleton } from '@/shared/ui'
import { useAdminMeQuery } from '@/entities/admin'
import { AdminShell } from '@/widgets/admin-shell'

const router = useRouter()
const me = useAdminMeQuery()

function onLoggedOut({ confirmed }: { confirmed: boolean }): void {
  void router.replace({ name: 'login', query: confirmed ? {} : { signout: 'unconfirmed' } })
}
</script>

<template>
  <div v-if="me.isPending.value" class="p-10" role="status" aria-label="Проверка доступа">
    <UiSkeleton class="mx-auto h-24 max-w-lg" />
  </div>
  <main v-else-if="me.isError.value" class="p-10">
    <UiErrorState
      :error="me.error.value"
      title="Не удалось проверить доступ"
      @retry="me.refetch()"
    />
  </main>
  <main v-else-if="!me.data.value?.platformAdmin" class="p-10">
    <UiAccessDenied
      title="Раздел недоступен"
      description="Администрирование платформы доступно только пользователям с правом администратора."
      back-label="Вернуться в LidRadar"
      @back="router.push({ name: 'radar' })"
    />
  </main>
  <AdminShell v-else @logged-out="onLoggedOut">
    <RouterView />
  </AdminShell>
</template>
