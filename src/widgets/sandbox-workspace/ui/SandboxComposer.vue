<script setup lang="ts">
/**
 * Поле нового сообщения и две равные кнопки отправителя. Enter ничего не отправляет: отправитель выбирается
 * явно, чтобы не написать от имени не той стороны.
 */
import { ref } from 'vue'
import { UiButton, UiField, UiInput } from '@/shared/ui'
import {
  MAX_TEXT_LENGTH,
  PAUSE_OPTIONS,
  formatPause,
  type SandboxDirection,
} from '@/entities/sandbox'
import SandboxChips from './SandboxChips.vue'

const props = defineProps<{
  mode: 'draft' | 'live'
  pause: number
  showPause: boolean
  busy: boolean
  locked: boolean
}>()
const emit = defineEmits<{
  add: [direction: SandboxDirection, text: string]
  'update:pause': [value: number]
}>()

const text = ref('')
const error = ref('')
const hint = ref('')
const pauseOptions = PAUSE_OPTIONS.map((value) => ({ value, label: formatPause(value) }))

function submit(direction: SandboxDirection): void {
  if (props.busy || props.locked) return
  const value = text.value.trim()
  if (!value) {
    error.value = 'Введите текст сообщения'
    return
  }
  if (value.length > MAX_TEXT_LENGTH) {
    error.value = `Не длиннее ${MAX_TEXT_LENGTH} символов`
    return
  }
  error.value = ''
  hint.value = ''
  emit('add', direction, value)
  text.value = ''
}

function onEnter(): void {
  hint.value = 'Выберите, от чьего имени отправить: «От клиента» или «От бизнеса».'
}

function onInput(value: string | undefined): void {
  text.value = value ?? ''
  if (error.value) error.value = ''
}
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="onEnter">
    <div v-if="showPause" class="flex flex-col gap-2">
      <span id="sandbox-pause-label" class="text-xs font-medium text-muted"
        >Пауза перед сообщением</span
      >
      <SandboxChips
        label="Пауза перед сообщением"
        :options="pauseOptions"
        :model-value="pause"
        :disabled="locked"
        @update:model-value="emit('update:pause', $event)"
      />
    </div>
    <UiField
      label="Текст сообщения"
      :error="error"
      :description="
        hint ||
        (mode === 'draft'
          ? 'Сообщение добавится в черновик. Его можно удалить до отправки.'
          : 'Сообщение уйдёт в систему сразу, с текущим временем.')
      "
    >
      <template #default="{ id, describedBy, invalid }">
        <UiInput
          :id="id"
          :model-value="text"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="locked"
          :maxlength="MAX_TEXT_LENGTH"
          placeholder="Хорошо, запишите меня на субботу"
          autocomplete="off"
          @update:model-value="onInput"
          @keydown.enter.prevent="onEnter"
        />
      </template>
    </UiField>
    <div class="flex flex-wrap justify-between gap-3">
      <UiButton variant="secondary" :disabled="locked" :loading="busy" @click="submit('INCOMING')">
        От клиента
      </UiButton>
      <UiButton variant="secondary" :disabled="locked" :loading="busy" @click="submit('OUTGOING')">
        От бизнеса
      </UiButton>
    </div>
  </form>
</template>
