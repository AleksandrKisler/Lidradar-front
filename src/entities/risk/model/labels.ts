/**
 * Подписи перечислений риска и корректирующего контура. Неизвестное значение
 * (новое на сервере) не роняет экран: показывается само значение и
 * нейтральный тон.
 */
import type {
  ActionType,
  OpportunityStage,
  OutcomeStatus,
  RiskFeedbackReason,
  RiskSeverity,
  RiskStatus,
  RiskType,
  RiskVerdict,
} from './types'

export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const severityLabels: Record<RiskSeverity, string> = {
  CRITICAL: 'Критично',
  HIGH: 'Высокий',
  MEDIUM: 'Средний',
  LOW: 'Низкий',
}

const severityTones: Record<RiskSeverity, Tone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
}

const typeLabels: Record<RiskType, string> = {
  NO_RESPONSE: 'Нет ответа клиенту',
  BOOKING_NOT_CONFIRMED: 'Запись не подтверждена',
  PROMISE_NOT_FULFILLED: 'Обещание не выполнено',
  CUSTOMER_SILENT_AFTER_PRICE: 'Клиент молчит после цены',
  FOLLOW_UP_CANDIDATE: 'Стоит напомнить о себе',
}

const statusLabels: Record<RiskStatus, string> = {
  OPEN: 'Новый',
  ACKNOWLEDGED: 'В работе',
  ACTED: 'Действие записано',
  RESOLVED: 'Закрыт',
  FALSE_POSITIVE: 'Ложное срабатывание',
  IGNORED: 'Проигнорирован',
  EXPIRED: 'Истёк',
}

const statusTones: Record<RiskStatus, Tone> = {
  OPEN: 'brand',
  ACKNOWLEDGED: 'info',
  ACTED: 'success',
  RESOLVED: 'success',
  FALSE_POSITIVE: 'neutral',
  IGNORED: 'neutral',
  EXPIRED: 'neutral',
}

const sourceLabels: Record<string, string> = {
  RULE: 'Правило',
  HYBRID: 'Правило и AI',
  MANUAL: 'Вручную',
}

const actionTypeLabels: Record<ActionType, string> = {
  OPEN_CONVERSATION: 'Переход в диалог',
  COPY_REPLY: 'Ответ скопирован',
  MARK_CONTACTED: 'Связались с клиентом',
  CALL: 'Звонок клиенту',
  SEND_MESSAGE: 'Сообщение отправлено',
  OTHER: 'Другое действие',
}

const outcomeStatusLabels: Record<OutcomeStatus, string> = {
  RESPONDED: 'Клиент ответил',
  BOOKED: 'Записан',
  PAID: 'Оплатил',
  LOST: 'Потерян',
  THINKING: 'Думает',
  NOT_A_LEAD: 'Не лид',
}

const stageLabels: Record<OpportunityStage, string> = {
  NEW: 'Новая',
  ENGAGED: 'В диалоге',
  QUALIFYING: 'Уточнение',
  PRICE_SENT: 'Цена отправлена',
  WAITING_CUSTOMER: 'Ждём клиента',
  WAITING_BUSINESS: 'Ждём ответа бизнеса',
  BOOKING_INTENT: 'Хочет записаться',
  BOOKED: 'Записан',
  WON: 'Выиграна',
  LOST: 'Потеряна',
  ARCHIVED: 'В архиве',
}

const verdictLabels: Record<RiskVerdict, string> = {
  TRUE_POSITIVE: 'Риск подтвердился',
  FALSE_POSITIVE: 'Ложное срабатывание',
}

const feedbackReasonLabels: Record<RiskFeedbackReason, string> = {
  CUSTOMER_ALREADY_ANSWERED: 'Клиенту уже ответили',
  CUSTOMER_ALREADY_BOOKED: 'Клиент уже записался',
  CUSTOMER_REJECTED: 'Клиент отказался',
  WRONG_INTERPRETATION: 'Сигнал понят неверно',
  NOT_A_LEAD: 'Это не клиент',
  OTHER: 'Другое',
}

const externalLinkUnavailableLabels: Record<string, string> = {
  PROVIDER_UNSUPPORTED: 'Внешний переход недоступен для этого канала',
  IDENTITY_UNKNOWN: 'Собеседник в канале не определён',
}

export function severityLabel(value: RiskSeverity | string): string {
  return severityLabels[value as RiskSeverity] ?? value
}

export function severityTone(value: RiskSeverity | string): Tone {
  return severityTones[value as RiskSeverity] ?? 'neutral'
}

export function riskTypeLabel(value: RiskType | string): string {
  return typeLabels[value as RiskType] ?? value
}

export function riskStatusLabel(value: RiskStatus | string): string {
  return statusLabels[value as RiskStatus] ?? value
}

export function riskStatusTone(value: RiskStatus | string): Tone {
  return statusTones[value as RiskStatus] ?? 'neutral'
}

export function riskSourceLabel(value: string): string {
  return sourceLabels[value] ?? value
}

export function actionTypeLabel(value: ActionType | string): string {
  return actionTypeLabels[value as ActionType] ?? value
}

export function outcomeStatusLabel(value: OutcomeStatus | string): string {
  return outcomeStatusLabels[value as OutcomeStatus] ?? value
}

export function opportunityStageLabel(value: OpportunityStage | string): string {
  return stageLabels[value as OpportunityStage] ?? value
}

/** Подпись причины, по которой сервер не построил внешнюю ссылку; `null`, если ссылка есть. */
export function externalLinkUnavailableLabel(reason: string | null): string | null {
  if (reason === null) return null
  return externalLinkUnavailableLabels[reason] ?? 'Внешний переход недоступен'
}

export function verdictLabel(value: RiskVerdict | string): string {
  return verdictLabels[value as RiskVerdict] ?? value
}

export function feedbackReasonLabel(value: RiskFeedbackReason | string): string {
  return feedbackReasonLabels[value as RiskFeedbackReason] ?? value
}
