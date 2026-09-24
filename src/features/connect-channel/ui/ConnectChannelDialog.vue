<script setup lang="ts">
/**
 * Диалог подключения источника (макеты 05 и 08).
 *
 * Секреты — write-only: после любой отправки поля токена и секрета
 * очищаются, а выпущенный сервером секрет webhook показывается один раз с
 * кнопкой копирования и нигде не сохраняется. `ACTIVE` означает успешную
 * проверку у провайдера, `ERROR` — подключение создано, но удалённая
 * настройка не завершилась (код объясняется безопасной подписью). При `503`
 * черновик без секретов остаётся в форме, пока диалог открыт.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiDialog,
  UiField,
  UiInput,
  UiPasswordInput,
  UiSelect,
  type UiSelectOption,
} from '@/shared/ui'
import type { Location } from '@/entities/location'
import {
  CONNECTABLE_PROVIDERS,
  connectionErrorLabel,
  connectionStatusLabel,
  connectionStatusTone,
  providerDescription,
  providerLabel,
  type ConnectChannelRequest,
  type ConnectedChannel,
  type ConnectorProvider,
} from '@/entities/integration'
import { connectChannelSchema, type ConnectChannelValues } from '../model/schema'
import { useConnectChannel } from '../model/use-connect-channel'

const props = defineProps<{ tenantId: string; locations: Location[] }>()
const emit = defineEmits<{ connected: [connection: ConnectedChannel] }>()
const open = defineModel<boolean>('open', { default: false })

const connect = useConnectChannel(() => props.tenantId)

const providerOptions: UiSelectOption[] = CONNECTABLE_PROVIDERS.map((value) => ({
  value,
  label: providerLabel(value),
}))
const locationOptions = computed<UiSelectOption[]>(() => [
  { value: '', label: 'Вся организация' },
  ...props.locations
    .filter((location) => location.active)
    .map((location) => ({
      value: location.id,
      label: location.name,
    })),
])

const { defineField, handleSubmit, errors, resetForm, setFieldValue, values, isSubmitting } =
  useForm({
    validationSchema: toTypedSchema(connectChannelSchema),
    initialValues: {
      provider: 'CONNECTED_BUSINESS_BOT',
      name: '',
      locationId: '',
      botToken: '',
      webhookSecret: '',
    },
  })
const [provider] = defineField('provider')
const [name] = defineField('name')
const [locationId] = defineField('locationId')
const [botToken] = defineField('botToken')
const [webhookSecret] = defineField('webhookSecret')

const isTelegram = computed(() => values.provider === 'CONNECTED_BUSINESS_BOT')
const description = computed(() =>
  values.provider ? providerDescription(values.provider as ConnectorProvider) : '',
)

const result = ref<ConnectedChannel | null>(null)
const copied = ref(false)
const errorView = computed(() => (connect.error.value ? describeError(connect.error.value) : null))
const traceId = computed(() => (isApiError(connect.error.value) ? connect.error.value.traceId : ''))
const unavailable = computed(
  () => isApiError(connect.error.value) && connect.error.value.httpStatus === 503,
)

/** Секреты не переживают отправку — ни успешную, ни неудачную. */
function clearSecrets(): void {
  setFieldValue('botToken', '')
  setFieldValue('webhookSecret', '')
}

/**
 * Синхронный замок на время отправки. Проверка формы асинхронна, поэтому
 * две отправки в её окне (двойной клик, клик и Enter) без замка создали бы
 * два подключения: `isPending` запроса обновляется позже, чем нужно.
 */
let inFlight = false

const onSubmit = handleSubmit(async (formValues) => {
  if (inFlight) return
  inFlight = true
  try {
    await submitValues(formValues)
  } finally {
    inFlight = false
  }
})

async function submitValues(formValues: ConnectChannelValues): Promise<void> {
  connect.reset()
  copied.value = false
  const body: ConnectChannelRequest = {
    name: formValues.name,
    locationId: formValues.locationId || null,
  }
  if (formValues.provider === 'CONNECTED_BUSINESS_BOT') body.botToken = formValues.botToken
  if (formValues.provider === 'GENERIC_WEBHOOK' && formValues.webhookSecret) {
    body.webhookSecret = formValues.webhookSecret
  }
  const created = await connect
    .mutateAsync({ provider: formValues.provider as ConnectorProvider, body })
    .catch(() => null)
  clearSecrets()
  if (created) {
    result.value = created
    emit('connected', created)
  }
}

async function copySecret(): Promise<void> {
  const secret = result.value?.webhookSecret
  if (!secret) return
  try {
    await navigator.clipboard.writeText(secret)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function finish(): void {
  open.value = false
}

// Закрытие уничтожает и черновик, и показанный один раз секрет.
watch(open, (isOpen) => {
  if (isOpen) return
  connect.reset()
  result.value = null
  copied.value = false
  resetForm({
    values: {
      provider: 'CONNECTED_BUSINESS_BOT',
      name: '',
      locationId: '',
      botToken: '',
      webhookSecret: '',
    },
  })
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Подключить источник"
    description="Переписка начнёт поступать в LidRadar после проверки подключения."
    size="lg"
    :dismissible="!connect.isPending.value"
  >
    <div v-if="result" class="flex flex-col gap-4">
      <UiAlert
        :tone="result.status === 'ACTIVE' ? 'success' : 'warning'"
        title="Подключение создано"
      >
        <span class="flex flex-wrap items-center gap-2">
          {{ result.name }} · {{ providerLabel(result.provider) }}
          <UiBadge :tone="connectionStatusTone(result.status)">
            {{ connectionStatusLabel(result.status) }}
          </UiBadge>
        </span>
        <span v-if="result.status !== 'ACTIVE'" class="mt-1 block">
          Удалённая настройка не завершилась<template v-if="result.lastErrorCode">
            : {{ connectionErrorLabel(result.lastErrorCode) }}</template
          >. Подключение сохранено — проверьте связь позже или подключите заново.
        </span>
      </UiAlert>
      <div
        v-if="result.webhookSecret"
        class="rounded-control border border-warning/40 bg-warning-pale p-4"
      >
        <p class="text-sm font-semibold text-ink">Секрет подписи webhook — показывается один раз</p>
        <p class="mt-1 text-xs text-ink/70">
          Скопируйте его в настройки отправляющей системы. После закрытия окна секрет получить
          нельзя — только подключить источник заново.
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <code
            class="rounded-field bg-paper px-3 py-2 text-sm break-all text-ink"
            data-testid="webhook-secret"
          >
            {{ result.webhookSecret }}
          </code>
          <UiButton size="sm" variant="secondary" @click="copySecret">Скопировать</UiButton>
          <span v-if="copied" class="text-xs text-success" role="status">Скопировано</span>
        </div>
      </div>
      <div class="flex justify-end">
        <UiButton @click="finish">Готово</UiButton>
      </div>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Источник"
        :description="description"
        :error="errors.provider"
      >
        <UiSelect
          :id="id"
          v-model="provider"
          name="provider"
          :options="providerOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="connect.isPending.value"
        />
      </UiField>
      <UiField
        v-slot="{ id, describedBy, invalid }"
        label="Название подключения"
        :error="errors.name"
      >
        <UiInput
          :id="id"
          v-model="name"
          name="connectionName"
          placeholder="Telegram · переписка клиентов"
          :maxlength="200"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="connect.isPending.value"
        />
      </UiField>
      <UiField v-slot="{ id, describedBy, invalid }" label="Точка" :error="errors.locationId">
        <UiSelect
          :id="id"
          v-model="locationId"
          name="connectionLocation"
          :options="locationOptions"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="connect.isPending.value"
        />
      </UiField>
      <UiField
        v-if="isTelegram"
        v-slot="{ id, describedBy, invalid }"
        label="Токен бота"
        description="Передаётся один раз по защищённому соединению, шифруется и не показывается снова."
        :error="errors.botToken"
      >
        <UiPasswordInput
          :id="id"
          v-model="botToken"
          name="botToken"
          autocomplete="new-password"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="connect.isPending.value"
        />
      </UiField>
      <UiField
        v-else
        v-slot="{ id, describedBy, invalid }"
        label="Секрет подписи (необязательно)"
        description="Оставьте пустым — сервер выпустит секрет и покажет его один раз."
        :error="errors.webhookSecret"
      >
        <UiPasswordInput
          :id="id"
          v-model="webhookSecret"
          name="webhookSecret"
          autocomplete="new-password"
          :described-by="describedBy"
          :invalid="invalid"
          :disabled="connect.isPending.value"
        />
      </UiField>

      <UiAlert v-if="unavailable" tone="warning" title="Подключение временно недоступно">
        Провайдер не ответил. Черновик без секретов сохранён, пока окно открыто: введите секрет
        заново и повторите попытку.
      </UiAlert>
      <UiAlert v-else-if="errorView" tone="danger" :title="errorView.title" :trace-id="traceId">
        {{ errorView.description }}
      </UiAlert>

      <div class="flex flex-wrap justify-end gap-3">
        <UiButton variant="secondary" :disabled="connect.isPending.value" @click="finish"
          >Отмена</UiButton
        >
        <UiButton type="submit" :loading="connect.isPending.value || isSubmitting">
          Подключить
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>
