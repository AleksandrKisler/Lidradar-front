<script setup lang="ts">
/**
 * Информационный блок. Предупреждения и ошибки объявляются как `alert`,
 * остальные тона — как `status`, чтобы вспомогательные технологии не
 * прерывали пользователя без необходимости.
 */
import UiIcon from './UiIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    tone?: 'info' | 'success' | 'warning' | 'danger' | undefined
    /** Пиктограмма выбранного макета; семантика и цвет остаются у tone. */
    icon?: IconName | undefined
    title?: string | undefined
    textClass?: string | undefined
    /** Идентификатор трассировки для обращения в поддержку. */
    traceId?: string | undefined
    /** Plain bordered feedback used by approved settings dialogs. */
    compact?: boolean | undefined
    /** R57 page feedback, only at desktop; existing dialog/compact appearances remain available. */
    privacyPage?: boolean | undefined
  }>(),
  {
    tone: 'info',
    icon: undefined,
    title: '',
    traceId: '',
    textClass: '',
    compact: false,
    privacyPage: false,
  },
)

const tones = {
  info: 'bg-info-pale text-ink',
  success: 'bg-success-pale text-ink',
  warning: 'bg-warning-pale text-ink',
  danger: 'bg-danger-pale text-ink',
} as const

const borders = {
  info: 'border-info/20',
  success: 'border-success/20',
  warning: 'border-warning/20',
  danger: 'border-danger/20',
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
    :class="[
      'text-sm leading-5',
      privacyPage ? 'rounded-card p-4' : 'rounded-field border',
      tones[tone],
      privacyPage ? '' : compact ? 'p-3' : 'px-[15px] py-[11px]',
      compact
        ? tone === 'danger'
          ? 'border-danger'
          : tone === 'success'
            ? 'border-success'
            : borders[tone]
        : borders[tone],
    ]"
  >
    <div class="flex items-start gap-3">
      <span v-if="$slots.icon" :class="['inline-flex size-5 shrink-0', titles[tone]]"
        ><slot name="icon"
      /></span>
      <UiIcon v-else-if="!compact" :name="icon ?? icons[tone]" :class="['size-5', titles[tone]]" />
      <div class="min-w-0" :class="privacyPage ? 'break-words' : ''">
        <p
          v-if="title"
          :class="[
            compact && !privacyPage ? 'font-normal' : 'font-medium',
            titles[tone],
            textClass,
          ]"
        >
          {{ title }}
        </p>
        <div
          v-if="!privacyPage || $slots.default"
          :class="title ? (privacyPage ? 'mt-1.5' : 'mt-1') : ''"
        >
          <slot />
        </div>
        <p v-if="traceId" class="mt-2 text-xs text-muted" :class="textClass">
          Идентификатор запроса: <code class="select-all">{{ traceId }}</code>
        </p>
      </div>
    </div>
  </div>
</template>
