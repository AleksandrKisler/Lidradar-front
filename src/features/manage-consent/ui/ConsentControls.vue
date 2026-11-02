<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { describeError, isApiError } from '@/shared/api'
import { UiAlert, UiButton, UiSheetDialog } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { consentKeys, grantConsent, revokeConsent, type MLConsentStatus } from '@/entities/consent'
import { usePrivacyContext } from '../model/use-privacy-context'

const props = withDefaults(
  defineProps<{
    tenantId: string
    status: MLConsentStatus
    blocked?: boolean
    inlineNotice?: boolean
    desktop?: boolean
    fallbackFocus?: () => HTMLElement | null
  }>(),
  { blocked: false, inlineNotice: true, fallbackFocus: () => null },
)
const emit = defineEmits<{
  changed: [status: MLConsentStatus | null]
  notice: [kind: 'grant' | 'revoke' | null, alreadyActive?: boolean]
}>()
const session = useSessionStore()
const client = useQueryClient()
const controls = ref<HTMLElement>()
const dialog = ref<'grant' | 'revoke' | null>(null)
const pending = ref(false)
const failure = ref<unknown>(null)
const notice = ref<string | null>(null)
const context = usePrivacyContext(
  () => props.tenantId,
  'organization.manage',
  () => {
    dialog.value = null
    pending.value = false
    failure.value = null
    notice.value = null
    emit('notice', null)
  },
)
const errorView = computed(() => (failure.value ? describeError(failure.value) : null))
const traceId = computed(() => (isApiError(failure.value) ? failure.value.traceId : ''))
const grantCopy = [
  'Переписки и вердикты команды смогут использоваться для обучения и оценки моделей LidRadar.',
  'Это добровольное решение владельца организации. Работа Radar и поиск рисков от него не зависят.',
  'По условиям согласия срок хранения новых текстов сообщений и пояснений к оценкам увеличивается с 90 до 365 дней.',
  'Согласие можно отозвать в любое время. Новые включения в наборы прекратятся; история решений сохранится.',
]
const revokeCopy = [
  'Новые переписки и вердикты перестанут включаться в наборы данных.',
  'Работа Radar продолжится без изменений.',
  'История выдачи и отзыва согласия сохранится.',
]
const granting = computed(() => dialog.value === 'grant')
const confirmationBlocked = computed(
  () =>
    props.blocked &&
    !(
      failure.value &&
      !(isApiError(failure.value) && (failure.value.isForbidden || failure.value.isUnauthenticated))
    ),
)
const title = computed(() =>
  granting.value ? 'Дать согласие на использование данных?' : 'Отозвать согласие?',
)
const busyStyle = computed(() =>
  pending.value
    ? { backgroundColor: 'var(--color-line)', color: 'var(--color-muted)', opacity: 0.6 }
    : undefined,
)
const command = computed(() => (granting.value ? 'Дать согласие' : 'Отозвать'))
const returnFocus = () => {
  const root = controls.value
  // A failed reconciliation can hide the invoking controls while the portal stays open.
  if (!root?.getClientRects().length) return props.fallbackFocus?.() ?? null
  return root.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? root
}
function open(kind: 'grant' | 'revoke') {
  if (pending.value || props.blocked || !context.capture()) return
  failure.value = null
  notice.value = null
  emit('notice', null)
  // Safari mouse activation can focus the tabindex group instead of its button.
  // Capture the actual invoking action before the modal's focus scope opens.
  returnFocus()?.focus({ preventScroll: true })
  dialog.value = kind
}
async function confirm() {
  const captured = context.capture(),
    kind = dialog.value
  if (!captured || !kind || pending.value || confirmationBlocked.value) return
  pending.value = true
  failure.value = null
  const key = consentKeys.status(captured.tenantId)
  try {
    const result = kind === 'grant' ? await grantConsent(captured.tenantId) : null
    if (kind === 'revoke') await revokeConsent(captured.tenantId)
    if (!context.current(captured)) return
    // Cancel an older read before applying the confirmed response; always reconcile with GET.
    await client.cancelQueries({ queryKey: key })
    if (!context.current(captured)) return
    if (result) client.setQueryData(key, result.status)
    pending.value = false
    dialog.value = null
    notice.value =
      kind === 'revoke'
        ? 'Согласие отозвано.'
        : result?.alreadyActive
          ? 'Согласие уже действовало: повторная выдача ничего не изменила.'
          : 'Согласие выдано.'
    emit('changed', result?.status ?? null)
    if (result?.alreadyActive) emit('notice', kind, true)
    else emit('notice', kind)
  } catch (error) {
    if (!context.current(captured)) return
    failure.value = error
    if (isApiError(error) && error.isForbidden) await session.refresh().catch(() => {})
  } finally {
    await client.invalidateQueries({
      queryKey: key,
      refetchType: context.current(captured) ? 'active' : 'none',
    })
    if (context.current(captured)) pending.value = false
  }
}
</script>

<template>
  <div
    ref="controls"
    tabindex="-1"
    role="group"
    aria-label="Действия с согласием"
    class="flex flex-col gap-3"
  >
    <div class="flex flex-wrap items-center gap-3">
      <UiButton
        :key="status.active ? 'revoke' : 'grant'"
        :variant="status.active ? 'secondary' : 'primary'"
        :disabled="pending || blocked"
        :style="{ width: desktop ? '190px' : '100%' }"
        @click="open(status.active ? 'revoke' : 'grant')"
        >{{ status.active ? 'Отозвать согласие' : 'Дать согласие' }}</UiButton
      >
      <a
        href="/legal/ai-data.html"
        target="_blank"
        rel="noopener"
        class="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
        >Условия использования данных ↗</a
      >
    </div>
    <UiAlert v-if="inlineNotice && notice" tone="success">{{ notice }}</UiAlert>
    <UiSheetDialog
      settings-redesign
      privacy-desktop
      :privacy-wide="desktop"
      :content-height="640"
      footer-fill
      size="sm"
      :open="dialog !== null"
      :title="title"
      description="Подтвердите решение об использовании данных организации."
      :dismissible="!pending"
      :return-focus="returnFocus"
      @update:open="
        (value) => {
          if (!value && !pending) dialog = null
        }
      "
    >
      <div class="flex flex-col gap-5 text-sm leading-5 text-muted">
        <p
          v-for="(paragraph, index) in granting ? grantCopy : revokeCopy"
          :key="paragraph"
          :class="
            index === 0
              ? 'text-base leading-[22px] font-semibold text-ink'
              : index === 3 || (!granting && index === 2)
                ? 'text-ink'
                : ''
          "
        >
          {{ paragraph }}
        </p>
        <a
          v-if="granting"
          href="/legal/ai-data.html"
          target="_blank"
          rel="noopener"
          class="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
          >Использование данных для улучшения AI ↗</a
        >
        <p v-if="pending" role="status">
          {{ granting ? 'Сохраняем решение…' : 'Отзываем согласие…' }}
        </p>
        <UiAlert
          v-if="errorView"
          tone="danger"
          compact
          privacy-page
          :title="`! Не удалось ${granting ? 'выдать' : 'отозвать'} согласие`"
          :trace-id="traceId"
        >
          {{
            isApiError(failure) && failure.isForbidden
              ? errorView.description
              : 'Попробуйте ещё раз.'
          }}
        </UiAlert>
      </div>
      <template #footer>
        <UiButton variant="secondary" :disabled="pending" :style="busyStyle" @click="dialog = null"
          >Отмена</UiButton
        >
        <UiButton
          :variant="granting ? 'primary' : 'danger'"
          :disabled="confirmationBlocked"
          :loading="pending"
          :style="busyStyle"
          :aria-label="failure ? 'Повторить' : command"
          @click="confirm"
          >{{
            pending ? (granting ? 'Сохраняем…' : 'Отзываем…') : failure ? 'Повторить' : command
          }}</UiButton
        >
      </template>
    </UiSheetDialog>
  </div>
</template>
