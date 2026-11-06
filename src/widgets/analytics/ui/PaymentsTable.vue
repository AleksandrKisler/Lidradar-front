<script setup lang="ts">
/** Подтверждённые события: порядок и денежные факты приходят с сервера. */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { formatAmount, formatDateTime, formatMoney, plural } from '@/shared/lib'
import { UiButton } from '@/shared/ui'
import type { Payment } from '@/entities/report'
import { useSessionStore } from '@/entities/session'

const props = defineProps<{
  items: Payment[]
  hasMore: boolean
  loadingMore: boolean
  timeZone: string
  nextError?: unknown
  invalidCursor?: boolean | undefined
}>()
const emit = defineEmits<{
  more: []
  reset: []
  navigate: [context: { eventId: string; link?: string }]
}>()
const route = useRoute()
const session = useSessionStore()
// Повтор события на границе cursor-страниц не должен создавать вторую запись.
const payments = computed(() => {
  const seen = new Set<string>()
  return props.items.filter((payment) => {
    if (seen.has(payment.eventId)) return false
    seen.add(payment.eventId)
    return true
  })
})
const attribution = {
  RECOVERED: 'После работы с риском',
  ORGANIC: 'Без связи с риском',
  UNKNOWN: 'Связь не определена',
} as const

function paymentAmount(payment: Payment): string {
  if (payment.currency === 'RUB') return formatMoney(payment.amount, payment.currency) ?? '—'
  const amount = formatAmount(payment.amount)
  return amount === null ? '—' : `${amount}\u00a0${payment.currency}`
}

/** Wrap only between thousands groups; the fractional group stays with its currency. */
function amountGroups(payment: Payment): string[] {
  const parts = paymentAmount(payment).split('\u00a0')
  if (parts.length < 2) return parts
  const currency = parts.pop()!
  const last = parts.pop()!
  return [...parts.map((part) => `${part}\u00a0`), `${last}\u00a0${currency}`]
}

function paymentDate(payment: Payment): string {
  const date = formatDateTime(payment.confirmedAt, props.timeZone)
  if (!date) return 'Дата не указана'
  try {
    const zone = new Intl.DateTimeFormat('ru-RU', {
      timeZone: props.timeZone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date(payment.confirmedAt))
      .find((part) => part.type === 'timeZoneName')?.value
    const caption = props.timeZone === 'Europe/Moscow' && zone === 'GMT+3' ? 'МСК' : zone
    return caption ? `${date} · ${caption}` : date
  } catch {
    return `${date} · UTC`
  }
}

function continueList(): void {
  if (props.loadingMore) return
  if (props.invalidCursor) emit('reset')
  else emit('more')
}
</script>

<template>
  <div class="payments-table">
    <p v-if="payments.length === 0" class="payments-empty">Подтверждённых оплат за период нет.</p>
    <template v-else>
      <ul class="payments-list" aria-label="Подтверждённые оплаты">
        <li
          v-for="payment in payments"
          :id="`payment-${payment.eventId}`"
          :key="payment.eventId"
          class="payment"
          :data-event-id="payment.eventId"
          :data-payment-id="payment.eventId"
          tabindex="-1"
        >
          <div class="payment-person">
            <p class="payment-title">{{ payment.contactDisplayName ?? 'Клиент без имени' }}</p>
            <p class="payment-service">{{ payment.serviceName ?? 'Услуга не указана' }}</p>
          </div>
          <p class="payment-amount">
            <span
              v-for="(part, index) in amountGroups(payment)"
              :key="index"
              class="amount-group"
              >{{ part }}</span
            >
          </p>
          <time :datetime="payment.confirmedAt" class="payment-date">
            {{ paymentDate(payment) }}
          </time>
          <p class="payment-attribution">{{ attribution[payment.attribution] }}</p>
          <div
            v-if="
              (payment.riskId && session.can('risks.read')) ||
              (payment.conversationId && session.can('conversation.read'))
            "
            class="payment-links"
          >
            <RouterLink
              v-if="payment.riskId && session.can('risks.read')"
              :to="{
                name: 'risk',
                params: { riskId: payment.riskId },
                query: { returnTo: route.fullPath },
              }"
              :aria-label="`Открыть риск · ${payment.contactDisplayName ?? 'Клиент без имени'}`"
              class="payment-link payment-link-risk"
              :data-payment-link="`${payment.eventId}:risk`"
              @click="emit('navigate', { eventId: payment.eventId, link: 'risk' })"
            >
              Открыть риск
            </RouterLink>
            <RouterLink
              v-if="payment.conversationId && session.can('conversation.read')"
              :to="{
                name: 'conversation',
                params: { conversationId: payment.conversationId },
                query: { returnTo: route.fullPath },
              }"
              :aria-label="`Открыть переписку · ${payment.contactDisplayName ?? 'Клиент без имени'}`"
              class="payment-link payment-link-conversation"
              :data-payment-link="`${payment.eventId}:conversation`"
              @click="emit('navigate', { eventId: payment.eventId, link: 'conversation' })"
            >
              Открыть переписку
            </RouterLink>
          </div>
        </li>
      </ul>
      <div class="payments-continuation">
        <p v-if="invalidCursor" role="alert">
          Список изменился. Обновите список, чтобы продолжить.
        </p>
        <p v-else-if="nextError" role="alert">
          Не удалось загрузить следующие оплаты. Показанные записи сохранены.
        </p>
        <UiButton
          v-if="hasMore || invalidCursor || nextError"
          class="payments-more"
          variant="secondary"
          :loading="loadingMore"
          @click="continueList"
        >
          {{
            loadingMore
              ? 'Загружаем…'
              : invalidCursor
                ? 'Обновить список'
                : nextError
                  ? 'Повторить'
                  : 'Показать ещё'
          }}
        </UiButton>
        <p v-else>Все оплаты загружены.</p>
        <p class="payments-count" role="status" aria-live="polite" aria-atomic="true">
          <span v-if="loadingMore">Загружаем следующие оплаты. </span>
          Загружено {{ payments.length }}
          {{ plural(payments.length, 'оплата', 'оплаты', 'оплат') }}. Суммы показаны в исходной
          валюте.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.payments-table {
  min-width: 0;
}
.payments-list {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.payment {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  background: #eef0f4;
  overflow-wrap: anywhere;
}
.payment-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
}
.payment-service {
  margin-top: 4px;
  color: #565b64;
  font-size: 14px;
  line-height: 20px;
}
.amount-group {
  display: inline-block;
  white-space: nowrap;
}
.payment-amount {
  overflow-wrap: normal;
  word-break: normal;
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
}
.payment-date {
  color: #565b64;
  font-size: 13px;
  line-height: 18px;
}
.payment-attribution {
  font-size: 15px;
  line-height: 22px;
}
.payment-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.payment-link {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 4px;
  border-radius: 9px;
  color: #005bb5;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}
.payment-link-risk {
  width: 124px;
}
.payment-link-conversation {
  width: 162px;
}
.payment-link:hover {
  background: #eff5ff;
  text-decoration: underline;
}
.payment-link:active {
  background: #dcecff;
}
.payment-link:focus-visible,
.payment:focus-visible {
  outline: 2px solid #0071e3;
  outline-offset: 2px;
}
.payments-continuation {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  font-size: 15px;
  line-height: 22px;
}
.payments-more {
  width: 240px;
  max-width: 100%;
}
.payments-count {
  color: #565b64;
  font-size: 12px;
  line-height: 18px;
}
.payments-empty {
  padding-block: 32px;
  color: #565b64;
  font-size: 15px;
  line-height: 22px;
}
@media (min-width: 640px) {
  .payments-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1280px) {
  .payments-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .payment {
    grid-template-columns: minmax(0, 304fr) minmax(0, 352fr) minmax(0, 160fr) minmax(0, 208fr);
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 16px;
    row-gap: 4px;
    min-height: 104px;
    padding: 16px 0;
    border-radius: 0;
    background: transparent;
  }
  .payment-person {
    grid-column: 1;
    grid-row: 1 / 3;
  }
  .payment-service {
    font-size: 12px;
    line-height: 18px;
  }
  .payment-attribution {
    grid-column: 2;
    grid-row: 1;
  }
  .payment-links {
    grid-column: 2;
    grid-row: 2;
  }
  .payment-link {
    font-size: 12px;
    line-height: 18px;
  }
  .payment-date {
    grid-column: 3;
    grid-row: 1 / 3;
  }
  .payment-amount {
    grid-column: 4;
    grid-row: 1 / 3;
    color: #087d50;
    text-align: right;
  }
}
</style>
