<script setup lang="ts">
/**
 * Информационный блок. Предупреждения и ошибки объявляются как `alert`,
 * остальные тона — как `status`, чтобы вспомогательные технологии не
 * прерывали пользователя без необходимости.
 */
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
  info: 'border-info/30 bg-info-pale text-ink',
  success: 'border-success/30 bg-success-pale text-ink',
  warning: 'border-warning/30 bg-warning-pale text-ink',
  danger: 'border-danger/30 bg-danger-pale text-ink',
} as const

const titles = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const
</script>

<template>
  <div
    :role="tone === 'danger' || tone === 'warning' ? 'alert' : 'status'"
    :class="['rounded-control border px-4 py-3 text-sm', tones[tone]]"
  >
    <p v-if="title" :class="['font-semibold', titles[tone]]">{{ title }}</p>
    <div :class="title ? 'mt-1' : ''"><slot /></div>
    <p v-if="traceId" class="mt-2 text-xs text-muted">
      Идентификатор запроса: <code class="select-all">{{ traceId }}</code>
    </p>
  </div>
</template>
