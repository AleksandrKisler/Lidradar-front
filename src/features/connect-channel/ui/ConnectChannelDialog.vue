<script setup lang="ts">
/** Подключение Telegram. Токен очищается после отправки и закрытия диалога. */
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
  connectionErrorLabel,
  connectionStatusView,
  providerLabel,
  type ConnectChannelRequest,
  type ConnectedChannel,
} from '@/entities/integration'
import { connectChannelSchema, type ConnectChannelValues } from '../model/schema'
import { useConnectChannel } from '../model/use-connect-channel'

const props = defineProps<{ tenantId: string; locations: Location[] }>()
const emit = defineEmits<{ connected: [connection: ConnectedChannel] }>()
const open = defineModel<boolean>('open', { default: false })

const connect = useConnectChannel(() => props.tenantId)

const locationOptions = computed<UiSelectOption[]>(() => [
  { value: '', label: 'Вся организация' },
  ...props.locations
    .filter((location) => location.active)
    .map((location) => ({
      value: location.id,
      label: location.name,
    })),
])

const { defineField, handleSubmit, errors, resetForm, setFieldValue, isSubmitting } = useForm({
  validationSchema: toTypedSchema(connectChannelSchema),
  initialValues: {
    name: '',
    locationId: '',
    botToken: '',
  },
})
const [name] = defineField('name')
const [locationId] = defineField('locationId')
const [botToken] = defineField('botToken')
const result = ref<ConnectedChannel | null>(null)
const resultStatus = computed(() =>
  result.value ? connectionStatusView(result.value.provider, result.value) : null,
)
const errorView = computed(() => (connect.error.value ? describeError(connect.error.value) : null))
const traceId = computed(() => (isApiError(connect.error.value) ? connect.error.value.traceId : ''))
const unavailable = computed(
  () => isApiError(connect.error.value) && connect.error.value.httpStatus === 503,
)

/** Токен не переживает отправку — ни успешную, ни неудачную. */
function clearToken(): void {
  setFieldValue('botToken', '')
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
  const body: ConnectChannelRequest = {
    name: formValues.name,
    locationId: formValues.locationId || null,
    botToken: formValues.botToken,
  }
  const created = await connect.mutateAsync(body).catch(() => null)
  clearToken()
  if (created) {
    result.value = created
    emit('connected', created)
  }
}

function finish(): void {
  open.value = false
}

// Закрытие уничтожает черновик и токен.
watch(open, (isOpen) => {
  if (isOpen) return
  connect.reset()
  result.value = null
  resetForm({
    values: {
      name: '',
      locationId: '',
      botToken: '',
    },
  })
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Подключить Telegram"
    description="Подключите переписку бизнес-аккаунта Telegram через вашего бота."
    size="lg"
    :dismissible="!connect.isPending.value"
  >
    <div v-if="result" class="flex flex-col gap-4">
      <UiAlert
        :tone="result.status !== 'ACTIVE' ? 'warning' : 'success'"
        title="Подключение создано"
      >
        <span class="flex flex-wrap items-center gap-2">
          {{ result.name }} · {{ providerLabel(result.provider) }}
          <UiBadge v-if="resultStatus" :tone="resultStatus.tone">
            {{ resultStatus.label }}
          </UiBadge>
        </span>
        <span v-if="result.status !== 'ACTIVE'" class="mt-1 block">
          Удалённая настройка не завершилась<template v-if="result.lastErrorCode">
            : {{ connectionErrorLabel(result.lastErrorCode) }}</template
          >. Подключение сохранено — проверьте связь позже или подключите заново.
        </span>
      </UiAlert>
      <UiAlert tone="info" title="Последний шаг в Telegram">
        Подключите этого бота к аккаунту Telegram: «Настройки» → «Изм.» → «Автоматизация чатов».
        Пока бот не подключён, сообщения не придут. Первое сообщение клиента появится в «Диалогах».
      </UiAlert>
      <div class="flex justify-end">
        <UiButton @click="finish">Готово</UiButton>
      </div>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
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
        v-slot="{ id, describedBy, invalid }"
        label="Токен бота"
        description="Токен выдаёт бот @BotFather. Передаётся один раз по защищённому соединению, шифруется и не показывается снова."
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
      <details
        class="rounded-control border border-line bg-canvas p-4 text-sm"
        data-testid="telegram-token-help"
      >
        <summary class="cursor-pointer font-medium text-brand-dark">Где взять токен бота</summary>
        <ol class="mt-3 flex list-decimal flex-col gap-2 pl-5 text-ink">
          <li>
            В Telegram найдите бота <span class="font-medium">@BotFather</span> и отправьте ему
            команду <code>/newbot</code>.
          </li>
          <li>
            Придумайте имя и адрес нового бота. BotFather пришлёт токен: длинную строку вида
            <code>123456789:AAH…</code>
          </li>
          <li>В BotFather откройте настройки этого бота и включите режим Business Mode.</li>
          <li>Вставьте токен в поле выше и нажмите «Подключить».</li>
          <li>
            Затем подключите бота к аккаунту: в Telegram откройте «Настройки» → «Изм.» →
            «Автоматизация чатов».
          </li>
        </ol>
        <p class="mt-3 text-xs text-muted">
          Названия пунктов зависят от версии Telegram. Токен никому не передавайте: он даёт полный
          доступ к боту.
        </p>
      </details>
      <UiAlert v-if="unavailable" tone="warning" title="Подключение временно недоступно">
        Не удалось связаться с Telegram, чтобы проверить токен, или подключение временно недоступно.
        Черновик без токена сохранён, пока окно открыто: введите токен заново и повторите попытку.
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
