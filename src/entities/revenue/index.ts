export type {
  ConfirmRevenueRequest,
  AttributionType,
  RevenueConfirmation,
  RevenueEvent,
  RevenueAttribution,
} from './model/types'
export { ATTRIBUTION_TYPES } from './model/types'
export { attributionLabel, attributionDescription } from './model/labels'
export { confirmRevenue, revenueKeys } from './api/revenue-api'
export type { ConfirmedRevenue } from './api/revenue-api'
