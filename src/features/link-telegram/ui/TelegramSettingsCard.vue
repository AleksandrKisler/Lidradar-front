<script setup lang="ts">
import { ref } from 'vue'
import { UiButton, UiErrorState, UiSkeleton, UiTooltip } from '@/shared/ui'
import { useTelegramLinkQuery } from '@/entities/notification'
import plane from './assets/telegram-plane.svg?no-inline'
import check from './assets/telegram-check.svg?no-inline'
import help from './assets/notification-help.svg?no-inline'
import TelegramSettingsDialog from './TelegramSettingsDialog.vue'
const props = defineProps<{ tenantId: string; timeZone: string; telegramSelected: boolean }>()
const status = useTelegramLinkQuery(() => props.tenantId)
const dialog = ref(false)
const disconnectRequested = ref(false)
function manage() {
  disconnectRequested.value = status.data.value?.linked ?? false
  dialog.value = true
}
</script>
<template>
  <section
    class="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-paper p-4 md:p-6"
    aria-labelledby="delivery-title"
  >
    <div class="flex items-center gap-1">
      <h2 id="delivery-title" class="text-xl leading-7 font-semibold text-ink">
        Куда приходят уведомления
      </h2>
      <UiTooltip
        v-slot="{ describedBy }"
        toggle-on-click
        :width="280"
        inverted
        align-end
        text="Подключение Telegram и доставка для каждого типа настраиваются отдельно."
      >
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center"
          aria-label="О доставке уведомлений"
          :aria-describedby="describedBy"
        >
          <img :src="help" alt="" width="20" height="20" />
        </button>
      </UiTooltip>
    </div>
    <div v-if="status.isPending.value" role="status" aria-label="Загрузка Telegram">
      <UiSkeleton class="h-16 w-full" />
    </div>
    <UiErrorState
      v-else-if="!status.data.value"
      :error="status.error.value"
      title="Не удалось прочитать статус Telegram"
      @retry="status.refetch()"
    />
    <template v-else>
      <div class="flex min-w-0 flex-col items-start gap-4 md:flex-row md:items-center">
        <div class="flex min-w-0 items-center gap-3 md:flex-1 md:gap-4">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0088cc]"
            ><img :src="plane" alt="" width="24" height="24"
          /></span>
          <div class="flex min-w-0 flex-col gap-1">
            <h3 class="text-base leading-[22px] font-semibold text-ink">Личный Telegram</h3>
            <p class="text-sm leading-5 text-muted">
              Бот уведомлений. Не источник переписки компании.
            </p>
          </div>
        </div>
        <span
          class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs leading-[18px]"
          :class="
            status.data.value.linked ? 'bg-success-pale text-success' : 'bg-canvas text-muted'
          "
        >
          <img v-if="status.data.value.linked" :src="check" alt="" width="14" height="14" />{{
            status.data.value.linked ? 'Подключён' : 'Не подключён'
          }}
        </span>
        <UiButton variant="secondary" class="w-full md:w-[220px]" @click="manage">{{
          status.data.value.linked ? 'Управлять' : 'Подключить Telegram'
        }}</UiButton>
      </div>
      <p v-if="status.isError.value" class="text-sm text-warning" role="alert">
        Статус не обновлён.
        <button type="button" class="underline" @click="status.refetch()">Повторить</button>
      </p>
    </template>
    <hr class="border-line" />
    <h3 class="text-base leading-[22px] font-semibold text-ink">Внутри LidRadar</h3>
    <p class="text-sm leading-5 text-muted">
      Выбирается в каждом правиле. Риски остаются в Radar, даже если уведомления выключены.
    </p>
    <p
      v-if="status.data.value?.linked === false && telegramSelected"
      class="text-sm leading-5 text-muted"
    >
      Telegram выбран в правилах, но сообщения начнут приходить только после личной привязки.
    </p>
    <TelegramSettingsDialog
      v-if="dialog"
      :tenant-id="tenantId"
      :time-zone="timeZone"
      :disconnect="disconnectRequested"
      @close="dialog = false"
    />
  </section>
</template>
