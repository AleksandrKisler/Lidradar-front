<script setup lang="ts">
/**
 * Точность сигналов по типам за окно обнаружения. `precision = null` —
 * «Недостаточно данных», а не 0 %; `reliable = false` — явная пометка
 * низкого покрытия вердиктами.
 */
import { formatDateTime } from '@/shared/lib'
import { UiBadge } from '@/shared/ui'
import { riskTypeLabel } from '@/entities/risk'
import { formatPercent, precisionView, type RiskPrecisionReport } from '@/entities/report'

defineProps<{ report: RiskPrecisionReport; timeZone: string }>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <p class="text-xs text-muted">
      Окно обнаружения с {{ formatDateTime(report.from, timeZone) }} по
      {{ formatDateTime(report.to, timeZone) }} (исключительно). Покрытие ниже
      {{ formatPercent(report.minimumCoverage) }} помечено как низкое.
    </p>
    <div
      class="relative overflow-x-auto"
      tabindex="0"
      role="region"
      aria-label="Таблица точности сигналов"
    >
      <table class="w-full min-w-[640px] text-left text-sm">
        <caption class="sr-only">
          Точность сигналов по типам
        </caption>
        <thead>
          <tr class="text-xs font-semibold tracking-wide text-muted">
            <th scope="col" class="pb-2">Тип</th>
            <th scope="col" class="pb-2 text-right">Рисков</th>
            <th scope="col" class="pb-2 text-right">С вердиктом</th>
            <th scope="col" class="pb-2 text-right">Покрытие</th>
            <th scope="col" class="pb-2 text-right">Точность</th>
            <th scope="col" class="pb-2 text-right">Ложные</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="item in report.items" :key="item.riskType">
            <th scope="row" class="py-2 pr-4 font-semibold text-ink">
              {{ riskTypeLabel(item.riskType) }}
            </th>
            <td class="py-2 text-right text-ink tabular-nums">{{ item.totalRisks }}</td>
            <td class="py-2 text-right text-ink tabular-nums">{{ item.withFeedback }}</td>
            <td class="py-2 text-right tabular-nums">
              <span class="inline-flex flex-wrap items-center justify-end gap-2">
                <span class="text-ink">{{ precisionView(item).coverage }}</span>
                <UiBadge v-if="precisionView(item).lowCoverage" tone="warning">
                  низкое покрытие
                </UiBadge>
              </span>
            </td>
            <td
              class="py-2 text-right tabular-nums"
              :class="precisionView(item).insufficient ? 'text-muted' : 'text-ink'"
            >
              {{ precisionView(item).precision }}
            </td>
            <td class="py-2 text-right text-ink tabular-nums">
              {{ precisionView(item).falsePositiveRate }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
