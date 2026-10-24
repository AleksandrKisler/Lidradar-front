<script setup lang="ts">
/** Новый виртуальный клиент: точка, шаблон и, при желании, имя. Шаблон заполняет черновик. */
import { computed, ref, watch } from 'vue'
import { UiButton, UiDialog, UiField, UiInput, UiSelect } from '@/shared/ui'
import { riskTypeLabel } from '@/entities/risk'
import type { SandboxTemplate } from '@/entities/sandbox'

const props = defineProps<{
  templates: readonly SandboxTemplate[]
  locations: readonly { id: string; name: string }[]
  replacesDraft: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  create: [templateCode: string, locationId: string, contactName: string]
}>()

const templateCode = ref('')
const locationId = ref('')
const contactName = ref('')
const error = ref('')

const locationOptions = computed(() =>
  props.locations.map((item) => ({ value: item.id, label: item.name })),
)

watch(open, (value) => {
  if (!value) return
  templateCode.value = props.templates[0]?.code ?? ''
  locationId.value = props.locations[0]?.id ?? ''
  contactName.value = ''
  error.value = ''
})

function create(): void {
  if (!templateCode.value || !locationId.value) {
    error.value = 'Выберите точку и шаблон'
    return
  }
  emit('create', templateCode.value, locationId.value, contactName.value.trim())
  open.value = false
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Новый клиент"
    description="Шаблон заполнит черновик, текст можно будет поправить. Без имени клиент получит синтетическое."
    size="lg"
  >
    <form class="flex flex-col gap-5" novalidate @submit.prevent="create">
      <UiField v-slot="{ id, describedBy, invalid }" label="Точка">
        <UiSelect
          :id="id"
          v-model="locationId"
          :options="locationOptions"
          :described-by="describedBy"
          :invalid="invalid"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Имя клиента"
        description="Необязательно"
      >
        <UiInput
          :id="id"
          v-model="contactName"
          :maxlength="100"
          placeholder="Анна Петрова"
          :described-by="describedBy"
          :invalid="invalid"
        />
      </UiField>
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-sm font-medium text-ink">Шаблон переписки</legend>
        <label
          v-for="template in templates"
          :key="template.code"
          class="grid cursor-pointer grid-cols-[20px_minmax(0,1fr)] gap-3 rounded-control px-3 py-2.5 hover:bg-canvas"
        >
          <input
            v-model="templateCode"
            type="radio"
            name="sandbox-template"
            :value="template.code"
            class="mt-1 size-4 accent-brand"
          />
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium text-ink">{{ template.name }}</span>
            <span class="text-xs text-muted">{{
              template.expectedRiskType
                ? `Ожидаем: ${riskTypeLabel(template.expectedRiskType)}`
                : 'Без ожидаемого риска'
            }}</span>
          </span>
        </label>
        <p v-if="!templates.length" class="text-sm text-muted">
          Шаблоны ещё не прошли проверку на этом стенде.
        </p>
      </fieldset>
      <p v-if="replacesDraft" class="text-sm text-warning">Текущий черновик будет заменён.</p>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Отмена</UiButton>
      <UiButton @click="create">Создать</UiButton>
    </template>
  </UiDialog>
</template>
