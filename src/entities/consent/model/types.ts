/** ML-согласие организации: область DATASETS, явное, активное и отзываемое (ADR 0038). */
import type { Schema } from '@/shared/api'

export type MLConsent = Schema<'MLConsent'>
export type MLConsentStatus = Schema<'MLConsentStatus'>

/** Состояние для интерфейса: действует, отозвано (есть история) или не выдавалось. */
export type ConsentState = 'active' | 'revoked' | 'never'

export function consentState(status: MLConsentStatus): ConsentState {
  if (status.active) return 'active'
  return status.consent ? 'revoked' : 'never'
}
