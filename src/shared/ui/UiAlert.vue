<script setup lang="ts">
/**
 * Информационный блок. Предупреждения и ошибки объявляются как `alert`,
 * остальные тона — как `status`, чтобы вспомогательные технологии не
 * прерывали пользователя без необходимости.
 */
import UiIcon from './UiIcon.vue'

withDefaults(
  defineProps<{
    tone?: 'info' | 'success' | 'warning' | 'danger' | undefined
    title?: string | undefined
    /** Идентификатор трассировки для обращения в поддержку. */
    traceId?: string | undefined
  }>(),
  { tone: 'info', title: '', traceId: '' },
)

const tones = {
  info: 'border-info/20 bg-info-pale text-ink',
  success: 'border-success/20 bg-success-pale text-ink',
  warning: 'border-warning/20 bg-warning-pale text-ink',
  danger: 'border-danger/20 bg-danger-pale text-ink',
} as const

const icons = {
  info: 'info',
  success: 'check-circle',
  warning: 'warning',
  danger: 'error',
} as const

const titles = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-ink',
} as const
</script>

<template>
  <div
    :role="tone === 'danger' || tone === 'warning' ? 'alert' : 'status'"
    :class="['rounded-field border px-[15px] py-[11px] text-sm leading-5', tones[tone]]"
  >
    <div class="flex items-start gap-3">
      <UiIcon :name="icons[tone]" :class="['size-5', titles[tone]]" />
      <div class="min-w-0">
        <p v-if="title" :class="['font-medium', titles[tone]]">{{ title }}</p>
        <div :class="title ? 'mt-1' : ''"><slot /></div>
        <p v-if="traceId" class="mt-2 text-xs text-muted">
          Идентификатор запроса: <code class="select-all">{{ traceId }}</code>
        </p>
      </div>
    </div>
  </div>
</template>
