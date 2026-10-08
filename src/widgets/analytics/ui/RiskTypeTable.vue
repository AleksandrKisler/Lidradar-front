<script setup lang="ts">
/** Счётчики рисков по типам за окно: найдено, отреагировали, закрыто, ложных. */
import { riskTypeLabel } from '@/entities/risk'
import type { AnalyticsRiskType } from '@/entities/report'

defineProps<{ rows: AnalyticsRiskType[] }>()
</script>

<template>
  <div
    class="relative overflow-x-auto"
    tabindex="0"
    role="region"
    aria-label="Таблица рисков по типам"
  >
    <table class="w-full min-w-[560px] text-left text-sm">
      <caption class="sr-only">
        Риски по типам
      </caption>
      <thead>
        <tr class="text-xs font-semibold tracking-wide text-muted">
          <th scope="col" class="pb-2">Тип</th>
          <th scope="col" class="pb-2 text-right">Найдено</th>
          <th scope="col" class="pb-2 text-right">Отреагировали</th>
          <th scope="col" class="pb-2 text-right">Закрыто</th>
          <th scope="col" class="pb-2 text-right">Ложных</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="row in rows" :key="row.riskType">
          <th scope="row" class="py-2 pr-4 font-semibold text-ink">
            {{ riskTypeLabel(row.riskType) }}
          </th>
          <td class="py-2 text-right text-ink tabular-nums">{{ row.detected }}</td>
          <td class="py-2 text-right text-ink tabular-nums">{{ row.acted }}</td>
          <td class="py-2 text-right text-ink tabular-nums">{{ row.resolved }}</td>
          <td class="py-2 text-right text-ink tabular-nums">{{ row.falsePositive }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
