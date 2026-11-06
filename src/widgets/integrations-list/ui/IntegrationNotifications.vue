<script setup lang="ts">
import { computed, nextTick, ref, toRef } from 'vue'
import { RouterLink } from 'vue-router'
import { UiSkeleton } from '@/shared/ui'
import { useTelegramLinkQuery } from '@/entities/notification'
import { TelegramNotifyDialog } from '@/features/link-telegram'
import bell from './assets/bell.svg'
import linkedBell from './assets/bell-linked.svg?no-inline'

const props = defineProps<{ tenantId: string; timeZone: string | null }>()
const status = useTelegramLinkQuery(toRef(props, 'tenantId'))
const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const linked = computed(() => status.data.value?.linked === true)
const label = computed(() =>
  linked.value || status.isError.value
    ? 'Уведомления в Telegram'
    : 'Подключить уведомления в Telegram',
)

async function closeDialog(): Promise<void> {
  open.value = false
  await nextTick()
  trigger.value?.focus()
}
</script>

<template>
  <section class="integration-notifications" aria-label="Личные уведомления в Telegram">
    <div v-if="status.isError.value" class="integration-notifications__error" role="alert">
      <div class="flex items-center gap-2 text-danger">
        <img :src="bell" width="15" height="15" alt="" />
        <p>Статус уведомлений недоступен</p>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-x-3">
        <button
          type="button"
          class="integration-notifications__retry integration-notifications__link"
          :disabled="status.isFetching.value"
          :aria-busy="status.isFetching.value"
          @click="status.refetch()"
        >
          Повторить
        </button>
        <RouterLink
          :to="{ name: 'settings-notifications' }"
          class="inline-flex min-h-11 items-center text-link"
          >Настройки уведомлений</RouterLink
        >
      </div>
    </div>
    <div
      v-else
      class="integration-notifications__row"
      :class="{ 'integration-notifications__row--pending': status.isPending.value }"
    >
      <div
        v-if="status.isPending.value"
        class="integration-notifications__pending"
        role="status"
        aria-label="Загружаем статус личных уведомлений"
      >
        <img :src="bell" width="15" height="15" alt="" />
        <span class="integration-notifications__link">Уведомления в Telegram</span>
      </div>
      <button
        v-else
        ref="trigger"
        type="button"
        class="integration-notifications__trigger integration-notifications__link"
        @click="open = true"
      >
        <img :src="linked ? linkedBell : bell" width="15" height="15" alt="" />
        <span>{{ label }}</span>
      </button>
      <UiSkeleton
        v-if="status.isPending.value"
        class="integration-notifications__skeleton"
        aria-hidden="true"
      />
      <p v-if="!status.isPending.value" class="integration-notifications__status" role="status">
        <span class="integration-notifications__dash" aria-hidden="true">— </span>
        {{ linked ? 'Подключены' : 'Не подключены' }}
      </p>
      <RouterLink
        :to="{ name: 'settings-notifications' }"
        class="integration-notifications__settings integration-notifications__link"
      >
        Настройки уведомлений
      </RouterLink>
    </div>
    <p
      class="integration-notifications__helper"
      :class="{ 'integration-notifications__helper--error': status.isError.value }"
    >
      Личные оповещения не подключают переписку клиентов.
    </p>
    <TelegramNotifyDialog v-if="open" :tenant-id="tenantId" @close="closeDialog" />
  </section>
</template>

<style scoped>
.integration-notifications {
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
}
.integration-notifications__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
  min-height: 46px;
}
.integration-notifications__link {
  color: var(--color-link);
  text-align: left;
  overflow-wrap: anywhere;
  border-radius: 4px;
}
.integration-notifications__link:hover {
  text-decoration: underline;
}
.integration-notifications__link:focus-visible {
  outline: 2px solid var(--color-brand, #0071e3);
  outline-offset: 3px;
}
.integration-notifications__trigger,
.integration-notifications__pending {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 46px;
}
.integration-notifications__trigger img,
.integration-notifications__pending img {
  flex: 0 0 15px;
  width: 15px;
  height: 15px;
}
.integration-notifications__skeleton {
  width: 126px;
  max-width: calc(100vw - 90px);
  height: 14px;
  background: var(--color-analytics-line);
  border-radius: 6px;
}
.integration-notifications__status {
  color: var(--color-secondary, #565b64);
  text-transform: lowercase;
}
.integration-notifications__settings {
  display: flex;
  align-items: center;
  flex: 0 0 180px;
  min-height: 46px;
  margin-left: auto;
}
.integration-notifications__helper {
  padding-left: 24px;
  margin-top: 4px;
  color: var(--color-secondary, #565b64);
}
.integration-notifications__error {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--color-secondary, #565b64);
}
.integration-notifications__helper--error {
  padding-left: 0;
}
.integration-notifications__retry {
  min-height: 44px;
  min-width: 44px;
}
.integration-notifications__retry:disabled {
  opacity: 0.6;
}
@media (max-width: 600px) {
  .integration-notifications__row {
    flex-direction: column;
    align-items: stretch;
  }
  .integration-notifications__status {
    font-size: 12px;
    line-height: 18px;
    text-transform: none;
  }
  .integration-notifications__dash {
    display: none;
  }
  .integration-notifications__settings {
    flex-basis: auto;
    margin-left: 0;
  }
  .integration-notifications__helper,
  .integration-notifications__error {
    padding-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .integration-notifications__skeleton {
    animation: none;
  }
}

@media (max-width: 767px) {
  .integration-notifications__row--pending {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .integration-notifications__row--pending .integration-notifications__pending {
    min-height: 20px;
  }
  .integration-notifications__row--pending .integration-notifications__skeleton {
    width: 130px;
    height: 18px;
  }
  .integration-notifications__row--pending .integration-notifications__settings {
    flex-basis: auto;
    margin-left: 0;
  }
  .integration-notifications:has(.integration-notifications__row--pending)
    .integration-notifications__helper {
    padding-left: 0;
  }
}
</style>
