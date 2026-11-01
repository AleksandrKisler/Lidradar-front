<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { GLYPHS, UiAlert, UiButton, UiGlyph, UiSheetDialog, UiTooltip } from '@/shared/ui'
import type { ServiceCatalogItem } from '@/entities/service'
import { useServiceCommands } from '../model/use-services-commands'
import active from './assets/service-switch-active.svg?no-inline'
import inactive from './assets/service-switch-inactive.svg?no-inline'

const props = withDefaults(
  defineProps<{
    tenantId: string
    service: ServiceCatalogItem
    layout?: 'desktop' | 'tablet' | 'phone'
    returnFocus?: (() => HTMLElement | null) | undefined
  }>(),
  { layout: 'desktop', returnFocus: undefined },
)
const emit = defineEmits<{ changed: [] }>()
const commands = useServiceCommands(() => props.tenantId)
const confirmOpen = ref(false)
const errorView = computed(() =>
  commands.error.value ? describeError(commands.error.value) : null,
)
const traceId = computed(() =>
  isApiError(commands.error.value) ? commands.error.value.traceId : '',
)
watch([() => props.tenantId, () => props.service.id], () => {
  confirmOpen.value = false
  commands.reset()
})
function toggle(event: Event) {
  ;(event.currentTarget as HTMLElement).focus()
  commands.reset()
  if (props.service.active) confirmOpen.value = true
  else void change(false)
}
async function change(deactivate: boolean) {
  if (commands.isPending.value) return
  const tenantId = props.tenantId,
    serviceId = props.service.id
  const succeeded = await commands
    .mutateAsync(
      deactivate
        ? { tenantId, kind: 'deactivate', serviceId }
        : { tenantId, kind: 'update', serviceId, body: { active: true } },
    )
    .then(() => true)
    .catch(() => false)
  if (!succeeded || tenantId !== props.tenantId || serviceId !== props.service.id) return
  confirmOpen.value = false
  emit('changed')
  await nextTick()
  if (document.activeElement === document.body) {
    const target = props.returnFocus?.()
    if (target?.isConnected) target.focus({ preventScroll: true })
  }
}
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <div class="flex items-center" :class="layout === 'desktop' ? 'gap-3' : 'gap-2'">
      <button
        type="button"
        role="switch"
        :aria-checked="service.active"
        :aria-label="`Активность услуги «${service.name}»`"
        :aria-busy="commands.isPending.value || undefined"
        :disabled="commands.isPending.value"
        class="flex size-11 shrink-0 items-center justify-center rounded-button disabled:opacity-45"
        @click="toggle"
      >
        <img :src="service.active ? active : inactive" width="40" height="24" alt="" />
      </button>
      <UiTooltip
        v-slot="{ describedBy }"
        align-end
        document-relative
        :width="layout === 'tablet' ? 358 : layout === 'phone' ? 324 : 320"
        :above="layout === 'tablet'"
        text="История сохраняется. Отключённую услугу можно включить снова. Она не участвует в новых сопоставлениях, но остаётся в прежних диалогах и рисках. Пустая цена означает «Не указана», а не нулевую выручку."
      >
        <button
          type="button"
          aria-label="Об отключении услуги и цене"
          :aria-describedby="describedBy"
          class="flex shrink-0 items-center justify-center"
          :class="layout === 'desktop' ? 'size-5' : 'size-11'"
        >
          <img :src="GLYPHS['settings-help']" width="20" height="20" alt="" />
        </button>
      </UiTooltip>
    </div>
    <p v-if="errorView && !confirmOpen" class="text-xs text-danger" role="alert">
      {{ errorView.title }}
    </p>
    <UiSheetDialog
      v-model:open="confirmOpen"
      title="Отключить услугу?"
      :description="service.name"
      entity-form
      description-in-body
      footer-fill
      size="sm"
      :dismissible="!commands.isPending.value"
      :return-focus="returnFocus"
    >
      <p class="text-sm leading-5 text-ink">
        Услуга перестанет участвовать в новых сопоставлениях. Она останется в истории диалогов и
        рисков. Вы сможете включить её снова.
      </p>
      <UiAlert
        v-if="errorView"
        tone="danger"
        class="mt-4 md:mt-6"
        title="Не удалось отключить услугу"
        :trace-id="traceId"
      >
        Повторите попытку. Если ошибка повторится, попробуйте позже.
        <template #icon><UiGlyph name="circle-alert" class="size-5" /></template>
      </UiAlert>
      <template #footer>
        <UiButton
          variant="secondary"
          class="disabled:text-muted"
          :disabled="commands.isPending.value"
          @click="confirmOpen = false"
          >Оставить активной</UiButton
        >
        <UiButton
          variant="secondary"
          style="color: var(--color-danger)"
          :loading="commands.isPending.value"
          @click="change(true)"
          >{{
            commands.isPending.value
              ? 'Отключаем…'
              : errorView
                ? 'Повторить отключение'
                : 'Отключить'
          }}</UiButton
        >
      </template>
    </UiSheetDialog>
  </div>
</template>
