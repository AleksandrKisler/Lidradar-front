/** Типы подтверждения выручки из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type ConfirmRevenueRequest = Schema<'ConfirmRevenueRequest'>
export type AttributionType = ConfirmRevenueRequest['attributionType']
export type RevenueConfirmation = Schema<'RevenueConfirmation'>
export type RevenueEvent = Schema<'RevenueEvent'>
export type RevenueAttribution = Schema<'RevenueAttribution'>

/** Порядок совпадает с макетом: доказанная связь первой. */
export const ATTRIBUTION_TYPES: readonly AttributionType[] = ['RECOVERED', 'ORGANIC', 'UNKNOWN']
