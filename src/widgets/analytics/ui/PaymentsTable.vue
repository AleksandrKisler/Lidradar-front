<script setup lang="ts">
/**
 * Подтверждённые оплаты окна от новых к старым. Каждая строка несёт свою
 * валюту и не суммируется с другими; связь с риском — ссылка на карточку.
 */
import { RouterLink } from 'vue-router'
import { formatDateTime, formatMoney } from '@/shared/lib'
import { UiButton } from '@/shared/ui'
import { attributionCaption, type Payment } from '@/entities/report'

defineProps<{
  items: Payment[]
  hasMore: boolean
  loadingMore: boolean
  timeZone: string
}>()
const emit = defineEmits<{ more: [] }>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="items.length === 0" class="py-8 text-center text-sm text-muted">
      Подтверждённых оплат за период нет.
    </p>
    <div
      v-else
      class="relative overflow-x-auto"
      tabindex="0"
      role="region"
      aria-label="Таблица подтверждённых оплат"
    >
      <table class="w-full min-w-[640px] text-left text-sm">
        <caption class="sr-only">
          Подтверждённые оплаты
        </caption>
        <thead>
          <tr class="text-xs font-semibold tracking-wide text-muted uppercase">
            <th scope="col" class="pb-2">Клиент / услуга</th>
            <th scope="col" class="pb-2">Связь с риском</th>
            <th scope="col" class="pb-2">Подтверждено</th>
            <th scope="col" class="pb-2 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="payment in items" :key="payment.eventId">
            <td class="py-3 pr-4">
              <span class="block font-semibold text-ink">
                {{ payment.contactDisplayName ?? 'Без имени' }}
              </span>
              <span class="block text-xs text-muted">
                {{ payment.serviceName ?? 'Услуга не уточнена' }}
              </span>
            </td>
            <td class="py-3 pr-4 text-muted">
              <RouterLink
                v-if="payment.riskId"
                :to="{ name: 'risk', params: { riskId: payment.riskId } }"
                class="font-semibold text-brand-dark hover:underline"
              >
                {{ attributionCaption(payment.attribution) }}
              </RouterLink>
              <template v-else>{{ attributionCaption(payment.attribution) }}</template>
            </td>
            <td class="py-3 pr-4 text-muted">
              {{ formatDateTime(payment.confirmedAt, timeZone) }}
            </td>
            <td
              class="py-3 text-right font-semibold tabular-nums"
              :class="payment.attribution === 'RECOVERED' ? 'text-success' : 'text-ink'"
            >
              {{ formatMoney(payment.amount, payment.currency) ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="hasMore" class="flex justify-center">
      <UiButton variant="secondary" :loading="loadingMore" @click="emit('more')">
        Показать ещё
      </UiButton>
    </div>
  </div>
</template>
