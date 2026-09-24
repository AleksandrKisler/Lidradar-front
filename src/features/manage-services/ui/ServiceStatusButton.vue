<script setup lang="ts">
/**
 * Отключение услуги (с подтверждением: она исчезнет из новых сопоставлений,
 * но останется в истории) и повторное включение через PATCH.
 */
import { computed, ref } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import type { ServiceCatalogItem } from '@/entities/service'
import { useServiceCommands } from '../model/use-services-commands'

const props = defineProps<{ tenantId: string; service: ServiceCatalogItem }>()
const emit = defineEmits<{ changed: [] }>()

const commands = useServiceCommands(() => props.tenantId)
const confirmOpen = ref(false)
const errorView = computed(() =>
  commands.error.value ? describeError(commands.error.value) : null,
)
const traceId = computed(() =>
  isApiError(commands.error.value) ? commands.error.value.traceId : '',
)

async function deactivate(): Promise<void> {
  const result = await commands
    .mutateAsync({ kind: 'deactivate', serviceId: props.service.id })
    .then(() => true)
    .catch(() => false)
  if (result) {
    confirmOpen.value = false
    emit('changed')
  }
}

async function reactivate(): Promise<void> {
  const result = await commands
    .mutateAsync({ kind: 'update', serviceId: props.service.id, body: { active: true } })
    .catch(() => null)
  if (result) emit('changed')
}
</script>

<template>
  <div class="flex flex-col items-end gap-1">
    <UiButton
      v-if="service.active"
      variant="ghost"
      size="sm"
      :disabled="commands.isPending.value"
      @click="confirmOpen = true"
    >
      Отключить
    </UiButton>
    <UiButton
      v-else
      variant="secondary"
      size="sm"
      :loading="commands.isPending.value"
      @click="reactivate"
    >
      Включить
    </UiButton>
    <p v-if="errorView && !confirmOpen" class="text-xs text-danger" role="alert">
      {{ errorView.title }}
    </p>
    <UiDialog
      v-model:open="confirmOpen"
      title="Отключить услугу?"
      description="Услуга исчезнет из новых сопоставлений, но останется в прежних диалогах и рисках. Включить её можно в любой момент."
      :dismissible="!commands.isPending.value"
    >
      <UiAlert v-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="commands.isPending.value"
          @click="confirmOpen = false"
        >
          Отмена
        </UiButton>
        <UiButton variant="danger" :loading="commands.isPending.value" @click="deactivate">
          Отключить
        </UiButton>
      </template>
    </UiDialog>
  </div>
</template>
