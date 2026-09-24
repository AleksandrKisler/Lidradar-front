export type { MLConsent, MLConsentStatus, ConsentState } from './model/types'
export { consentState } from './model/types'
export {
  consentKeys,
  fetchConsent,
  grantConsent,
  revokeConsent,
  useConsentQuery,
} from './api/consent-api'
export type { GrantResult } from './api/consent-api'
