/** Аналитика за календарное окно организации и точность сигналов (ADR 0039). */
import type { Schema } from '@/shared/api'

export type AnalyticsSummary = Schema<'AnalyticsSummary'>
export type AnalyticsPeriod = Schema<'AnalyticsPeriod'>
export type AnalyticsDailyPoint = Schema<'AnalyticsDailyPoint'>
export type AnalyticsAttributionSplit = Schema<'AnalyticsAttributionSplit'>
export type AnalyticsRiskType = Schema<'AnalyticsRiskType'>
export type Payment = Schema<'Payment'>
export type PaymentPage = Schema<'PaymentPage'>
export type RiskPrecisionReport = Schema<'RiskPrecisionReport'>
export type RiskPrecisionItem = Schema<'RiskPrecisionItem'>

/** Окно включительных календарных дат организации `YYYY-MM-DD`. */
export interface DateRange {
  from: string
  to: string
}

/** Границы окна как моменты UTC: начало включительно, конец исключительно. */
export interface InstantRange {
  from: string
  to: string
}

export const MAX_RANGE_DAYS = 366
export const DEFAULT_RANGE_DAYS = 30
export const PAYMENTS_PAGE_SIZE = 20
