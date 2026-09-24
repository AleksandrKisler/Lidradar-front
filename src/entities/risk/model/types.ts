/** Типы Radar, риска и корректирующего контура из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type RiskDetail = Schema<'RiskDetail'>
export type Risk = Schema<'Risk'>
export type RiskSeverity = Schema<'RiskSeverity'>
export type RiskType = Schema<'RiskType'>
export type RiskStatus = Schema<'RiskStatus'>
export type RadarSummary = Schema<'RadarSummary'>
export type Recommendation = Schema<'Recommendation'>
export type Action = Schema<'Action'>
export type ActionType = Schema<'ActionType'>
export type Outcome = Schema<'Outcome'>
export type OutcomeStatus = Schema<'OutcomeStatus'>
export type OpportunityStage = Schema<'OpportunityStage'>
export type OpportunityStageSource = Schema<'OpportunityStageSource'>
export type Opportunity = Schema<'Opportunity'>
export type OpportunityDetail = Schema<'OpportunityDetail'>
export type OpportunityStageHistory = Schema<'OpportunityStageHistory'>
export type RiskFeedback = Schema<'RiskFeedback'>
export type RiskFeedbackRequest = Schema<'RiskFeedbackRequest'>
export type RiskVerdict = Schema<'RiskVerdict'>
export type RiskFeedbackReason = Schema<'RiskFeedbackReason'>

/**
 * Бизнес-фильтры, общие для сводки и ленты. Статусы намеренно не входят:
 * лента всегда запрашивает активные риски (`active=true`), а сводка считает
 * возвращённую выручку по всем рискам фильтра — сужать её статусом нельзя.
 */
export interface RiskFilters {
  locationId?: string | undefined
  severity?: RiskSeverity | undefined
  riskType?: RiskType | undefined
}

export const RISK_SEVERITIES: readonly RiskSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export const RISK_TYPES: readonly RiskType[] = [
  'NO_RESPONSE',
  'BOOKING_NOT_CONFIRMED',
  'PROMISE_NOT_FULFILLED',
  'CUSTOMER_SILENT_AFTER_PRICE',
  'FOLLOW_UP_CANDIDATE',
]

/** Активные статусы: команды доступны только над ними, остальные терминальные. */
export const ACTIVE_RISK_STATUSES: readonly RiskStatus[] = ['OPEN', 'ACKNOWLEDGED', 'ACTED']

/** Неизвестный статус (новый на сервере) команды не активирует. */
export function isActiveRiskStatus(status: string): boolean {
  return (ACTIVE_RISK_STATUSES as readonly string[]).includes(status)
}

/**
 * Типы действий, которые менеджер выбирает вручную. `OPEN_CONVERSATION`
 * записывается только после фактического перехода во внешний канал.
 */
export const MANUAL_ACTION_TYPES: readonly ActionType[] = [
  'MARK_CONTACTED',
  'CALL',
  'SEND_MESSAGE',
  'COPY_REPLY',
  'OTHER',
]

export const OUTCOME_STATUSES: readonly OutcomeStatus[] = [
  'RESPONDED',
  'THINKING',
  'BOOKED',
  'PAID',
  'LOST',
  'NOT_A_LEAD',
]

export const RISK_VERDICTS: readonly RiskVerdict[] = ['TRUE_POSITIVE', 'FALSE_POSITIVE']

/**
 * Причины ложного срабатывания; `NOT_A_LEAD` дополнительно закрывает сделку
 * как потерянную, поэтому стоит последней перед «другое».
 */
export const FEEDBACK_REASONS: readonly RiskFeedbackReason[] = [
  'CUSTOMER_ALREADY_ANSWERED',
  'CUSTOMER_ALREADY_BOOKED',
  'CUSTOMER_REJECTED',
  'WRONG_INTERPRETATION',
  'NOT_A_LEAD',
  'OTHER',
]
