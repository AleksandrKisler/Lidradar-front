<script setup lang="ts">
/**
 * Кнопки команд над мёртвым объектом с подтверждением, в котором названы тип,
 * идентификатор, организация и операция. Одиночные команды, без массовых.
 */
import { computed, ref } from 'vue'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiDialog } from '@/shared/ui'
import { deadLetterKindLabel, recoveryActionLabel, type RecoveryAction } from '@/entities/admin'
import { availableActions, useRecoveryCommand, type RecoveryTarget } from '../model/commands'

const props = defineProps<{ target: RecoveryTarget }>()
const emit = defineEmits<{ done: [action: RecoveryAction] }>()

const command = useRecoveryCommand()
const actions = computed(() => availableActions(props.target))
const pendingAction = ref<RecoveryAction | null>(null)

const conflict = computed(
  () => isApiError(command.error.value) && command.error.value.httpStatus === 409,
)
const errorView = computed(() => {
  if (!command.error.value) return null
  if (conflict.value) {
    return {
      title: 'Состояние уже изменилось',
      description:
        'Объект больше не мёртвый, уже отложен или конфликтует с более новым заданием. Список перечитан.',
    }
  }
  return describeError(command.error.value)
})
const traceId = computed(() => (isApiError(command.error.value) ? command.error.value.traceId : ''))

const descriptions: Record<RecoveryAction, string> = {
  retry: 'Объект вернётся в очередь с нулевым счётчиком попыток.',
  replay: 'Событие будет отправлено заново с нулевым счётчиком попыток.',
  discard: 'Объект будет отложен и пропадёт из списка мёртвых; запись сохраняется.',
}

function open(action: RecoveryAction): void {
  command.reset()
  pendingAction.value = action
}

async function confirm(): Promise<void> {
  const action = pendingAction.value
  if (!action) return
  const ok = await command
    .mutateAsync({ target: props.target, action })
    .then(() => true)
    .catch(() => false)
  if (!ok) return
  pendingAction.value = null
  emit('done', action)
}
</script>

<template>
  <div v-if="actions.length" class="flex flex-wrap items-center gap-2">
    <UiButton
      v-for="action in actions"
      :key="action"
      size="sm"
      :variant="action === 'discard' ? 'secondary' : 'primary'"
      :disabled="command.isPending.value"
      @click="open(action)"
    >
      {{ recoveryActionLabel(action) }}
    </UiButton>
    <UiDialog
      :open="pendingAction !== null"
      :title="
        pendingAction
          ? `${recoveryActionLabel(pendingAction)}: ${deadLetterKindLabel(target.kind).toLowerCase()}?`
          : ''
      "
      :description="pendingAction ? descriptions[pendingAction] : ''"
      :dismissible="!command.isPending.value"
      @update:open="(value) => (pendingAction = value ? pendingAction : null)"
    >
      <dl class="grid gap-1 text-sm">
        <div class="flex gap-2">
          <dt class="text-muted">Тип</dt>
          <dd class="text-ink">{{ deadLetterKindLabel(target.kind) }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="text-muted">Объект</dt>
          <dd class="break-all text-ink">
            <code>{{ target.id }}</code>
          </dd>
        </div>
        <div class="flex gap-2">
          <dt class="text-muted">Организация</dt>
          <dd class="break-all text-ink">
            <code>{{ target.tenantId }}</code>
          </dd>
        </div>
      </dl>
      <UiAlert
        v-if="errorView"
        :tone="conflict ? 'warning' : 'danger'"
        :title="errorView.title"
        :trace-id="traceId"
      >
        {{ errorView.description }}
      </UiAlert>
      <template #footer>
        <UiButton
          variant="secondary"
          :disabled="command.isPending.value"
          @click="pendingAction = null"
        >
          Отмена
        </UiButton>
        <UiButton
          :variant="pendingAction === 'discard' ? 'danger' : 'primary'"
          :loading="command.isPending.value"
          @click="confirm"
        >
          {{ pendingAction ? recoveryActionLabel(pendingAction) : '' }}
        </UiButton>
      </template>
    </UiDialog>
  </div>
  <span v-else class="text-xs text-muted">{{
    target.discardedAt ? 'Отложено' : 'Команд нет'
  }}</span>
</template>
