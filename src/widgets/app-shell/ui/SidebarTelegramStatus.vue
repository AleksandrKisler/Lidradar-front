<script setup lang="ts">
/**
 * Состояние подключения Telegram в боковом меню (Figma 201:6656). Источник —
 * кэш статуса настройки: «Подключён» только при подтверждённом
 * `facts.liveConnections > 0`. Личная привязка `telegramLinked` источником
 * бизнес-переписки не является. Роли без права настройки и неизвестный статус
 * (загрузка, ошибка) блок не показывают, лишних запросов нет.
 */
import { computed } from 'vue'
import { UiGlyph } from '@/shared/ui'
import { useOnboardingQuery } from '@/entities/organization'
import { useSessionStore } from '@/entities/session'

const session = useSessionStore()
const onboarding = useOnboardingQuery(
  () => (session.can('location.manage') ? session.tenantId : null),
  { staleTime: 5 * 60_000 },
)
// Ошибка перечитывания оставляет прежние данные в кэше: неизвестный статус не показываем.
const connected = computed(
  () => !onboarding.isError.value && (onboarding.data.value?.facts.liveConnections ?? 0) > 0,
)
</script>

<template>
  <div
    v-if="connected"
    class="flex h-16 items-center gap-2.5 rounded-button border border-hairline bg-paper px-2.5"
    role="status"
  >
    <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-pale">
      <UiGlyph name="check" class="size-4 text-success" />
    </span>
    <span class="flex min-w-0 flex-col">
      <span class="text-sm leading-5 font-medium text-ink">Telegram</span>
      <span class="text-xs leading-[18px] text-secondary">Подключён</span>
    </span>
  </div>
</template>
