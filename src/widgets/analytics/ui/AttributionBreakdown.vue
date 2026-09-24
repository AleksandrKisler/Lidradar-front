<script setup lang="ts">
/**
 * Разделение подтверждённых оплат по атрибуции в порядке сервера:
 * RECOVERED, ORGANIC, UNKNOWN. Суммы не складываются на клиенте.
 */
import { formatMoney } from '@/shared/lib'
import { attributionCaption, type AnalyticsAttributionSplit } from '@/entities/report'

defineProps<{ attribution: AnalyticsAttributionSplit[]; currency: string }>()
</script>

<template>
  <dl class="flex flex-col gap-4">
    <div v-for="row in attribution" :key="row.type">
      <dt class="order-2 text-sm text-muted">
        {{ attributionCaption(row.type) }} · {{ row.count }}
        {{ row.count === 1 ? 'оплата' : row.count >= 2 && row.count <= 4 ? 'оплаты' : 'оплат' }}
      </dt>
      <dd
        class="text-2xl font-bold tabular-nums"
        :class="row.type === 'RECOVERED' ? 'text-success' : 'text-ink'"
      >
        {{ formatMoney(row.amount, currency) ?? '—' }}
      </dd>
    </div>
  </dl>
</template>
