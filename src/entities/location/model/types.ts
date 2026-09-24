/** Типы точек и графика работы из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type Location = Schema<'Location'>
export type BusinessHour = Schema<'BusinessHour'>
export type CreateLocationRequest = Schema<'CreateLocationRequest'>
export type UpdateLocationRequest = Schema<'UpdateLocationRequest'>
export type BusinessHoursRequest = Schema<'BusinessHoursRequest'>

export const RESPONSE_THRESHOLD_DEFAULT = 45
export const RESPONSE_THRESHOLD_MIN = 1
export const RESPONSE_THRESHOLD_MAX = 1440
