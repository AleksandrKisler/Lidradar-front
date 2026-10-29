<script setup lang="ts">
/** Подключение Telegram. Токен очищается после отправки и закрытия диалога. */
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/valibot'
import { describeError, isApiError } from '@/shared/api'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiChannelMark,
  UiField,
  UiIcon,
  UiInput,
  UiPasswordInput,
  UiSelect,
  UiSheetDialog,
  UiSkeleton,
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

const props = defineProps<{
  tenantId: string
  locations: Location[]
  loading?: boolean | undefined
}>()
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
/** Telegram не принял токен: текст макета выводится под полем, а не отдельным сообщением. */
const tokenRejected = computed(
  () =>
    isApiError(connect.error.value) && connect.error.value.code === 'CHANNEL_CREDENTIALS_REJECTED',
)
const unavailable = computed(
  () => isApiError(connect.error.value) && connect.error.value.httpStatus === 503,
)

// Новый токен снимает прежний отказ: сообщение относилось к прежнему значению.
watch(botToken, (value) => {
  if (value && tokenRejected.value) connect.reset()
})

/** Токен не переживает отправку — ни успешную, ни неудачную. */
function clearToken(): void {
  setFieldValue('botToken', '', false)
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

const TOKEN_REJECTED_TEXT =
  'Токен не принят. Скопируйте его целиком из BotFather и проверьте Secretary Mode.'

const TOKEN_STEPS = [
  ['Создайте бота', 'Откройте @BotFather → Create a New Bot и заполните форму.'],
  ['Получите токен', 'Скопируйте API-токен созданного бота целиком.'],
  [
    'Включите Secretary Mode',
    'В BotFather откройте настройки созданного бота и включите Secretary Mode.',
  ],
  ['Выберите чаты в Telegram', 'Настройки → Изм. → Автоматизация чатов. Выберите бота.'],
  ['Завершите подключение в LidRadar', 'Вставьте токен в поле слева и нажмите «Подключить».'],
] as const

const instructionOpen = ref(false)
const TelegramInstructionDialog = defineAsyncComponent(
  () => import('./TelegramInstructionDialog.vue'),
)

function finish(): void {
  open.value = false
}

// Закрытие уничтожает черновик и токен.
watch(open, (isOpen) => {
  if (isOpen) return
  connect.reset()
  result.value = null
  instructionOpen.value = false
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
  <UiSheetDialog
    v-model:open="open"
    title="Подключить Telegram"
    description="Подключите переписку бизнес-аккаунта Telegram через своего бота."
    size="lg"
    :dismissible="!(connect.isPending.value || isSubmitting)"
    :concealed="instructionOpen"
  >
    <template #mark><UiChannelMark kind="telegram" /></template>

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
    </div>

    <div
      v-else
      class="flex flex-col gap-6 max-md:mt-3 lg:grid lg:grid-cols-[352px_minmax(0,1fr)] lg:gap-7"
    >
      <form
        id="connect-channel-form"
        class="flex flex-col gap-5"
        novalidate
        @submit.prevent="onSubmit"
      >
        <div v-if="loading" class="flex flex-col gap-5" role="status" aria-label="Загружаем точки">
          <div v-for="n in 3" :key="n" class="flex flex-col gap-3">
            <UiSkeleton class="h-2.5 w-2/3" />
            <UiSkeleton class="h-input w-full" />
          </div>
          <div class="flex flex-col gap-2 pl-6">
            <UiSkeleton class="h-2.5 w-full" />
            <UiSkeleton class="h-2.5 w-3/4" />
            <UiSkeleton class="h-2.5 w-1/2" />
          </div>
        </div>
        <template v-else>
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
          <div class="flex flex-col gap-2">
            <UiField
              v-slot="{ id, describedBy, invalid }"
              label="Токен бота"
              :error="tokenRejected ? TOKEN_REJECTED_TEXT : errors.botToken"
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
            <p class="mt-[11px] flex items-start gap-2 text-xs text-secondary">
              <UiIcon name="lock" class="mt-0.5 size-3.5 shrink-0" />
              Токен выдаёт @BotFather. Передаётся один раз по защищённому соединению, шифруется и
              снова не показывается.
            </p>
          </div>
        </template>
        <UiAlert v-if="unavailable" tone="warning" title="Подключение временно недоступно">
          Не удалось связаться с Telegram, чтобы проверить токен, или подключение временно
          недоступно. Черновик без токена сохранён, пока окно открыто: введите токен заново и
          повторите попытку.
        </UiAlert>
        <UiAlert
          v-else-if="errorView && !tokenRejected"
          tone="danger"
          :title="errorView.title"
          :trace-id="traceId"
        >
          {{ errorView.description }}
        </UiAlert>
      </form>

      <section
        class="flex flex-col gap-4 rounded-[20px] bg-canvas p-6 lg:self-start"
        data-testid="telegram-token-help"
      >
        <h3 class="text-field font-semibold text-ink">Где взять токен бота</h3>
        <ol class="flex flex-col gap-4">
          <li v-for="([title, text], index) in TOKEN_STEPS" :key="title" class="flex gap-3">
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-xs text-secondary"
              aria-hidden="true"
              >{{ index + 1 }}</span
            >
            <span class="flex flex-col">
              <span class="text-sm font-medium text-ink">{{ title }}</span>
              <span class="mt-[3px] text-sm text-secondary">{{ text }}</span>
            </span>
          </li>
        </ol>
        <button
          type="button"
          class="self-start text-sm text-link underline"
          @click="instructionOpen = true"
        >
          Подробная инструкция со скриншотами
        </button>
        <div class="flex flex-col gap-1.5 border-t border-line pt-4 text-xs">
          <p class="text-secondary">Названия пунктов зависят от версии Telegram.</p>
          <p class="text-ink">Никому не передавайте токен: он даёт полный доступ к боту.</p>
        </div>
      </section>
    </div>

    <TelegramInstructionDialog v-if="instructionOpen" v-model:open="instructionOpen" />

    <template #footer>
      <UiButton v-if="result" @click="finish">Готово</UiButton>
      <template v-else>
        <UiButton
          variant="secondary"
          class="!opacity-100 md:w-[100px]"
          :disabled="connect.isPending.value"
          @click="finish"
          >Отмена</UiButton
        >
        <UiButton
          type="submit"
          class="md:min-w-[196px]"
          form="connect-channel-form"
          :disabled="loading"
          :loading="connect.isPending.value || isSubmitting"
        >
          {{ connect.isPending.value || isSubmitting ? 'Подключаем…' : 'Подключить' }}
        </UiButton>
      </template>
    </template>
  </UiSheetDialog>
</template>
