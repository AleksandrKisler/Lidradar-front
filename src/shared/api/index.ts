/**
 * Публичный API транспортного слоя.
 *
 * Сущности вызывают `apiClient` (типизирован схемой OpenAPI) и оборачивают
 * результат в `unwrap`, получая данные либо `ApiError`. Сгенерированные типы
 * доступны только через этот модуль.
 */
import type { components } from './generated/schema'

export type { paths, components, operations } from './generated/schema'
export { apiClient } from './client/instance'
export {
  createApiClient,
  unwrap,
  unwrapWithStatus,
  DEFAULT_TIMEOUT_MS,
} from './client/create-client'
export type { ApiClient, CreateApiClientOptions } from './client/create-client'
export { ApiError, isApiError, parseRetryAfter, CLIENT_ERROR_CODES } from './client/api-error'
export type { ApiErrorInit } from './client/api-error'
export { describeError } from './client/messages'
export type { ApiErrorDescription } from './client/messages'
export { setApiContext, resetApiContext, getApiContext } from './client/context'
export type { ApiContext } from './client/context'
export { isTenantScopedPath, isMachinePath, isSessionLossPath } from './client/scope'
export { tenantScope, normalizeFilters, shouldRetryRead } from './client/query'
export { draftFor, settleFailure, isUnknownResult, sameBody } from './client/idempotency'
export type { IdempotentDraft, DraftState } from './client/idempotency'
export { useIdempotentMutation } from './client/use-idempotent-mutation'
export type {
  IdempotentMutation,
  IdempotentMutationOptions,
  IdempotentStatus,
} from './client/use-idempotent-mutation'

/** Сокращение для схем контракта: `Schema<'RiskDetail'>`. */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]
export {
  SseParser,
  SseBufferOverflowError,
  readEventStream,
  DEFAULT_SSE_BUFFER_LIMIT,
} from './client/sse'
export type { SseMessage, ReadEventStreamOptions } from './client/sse'
export { backoffDelay } from './client/backoff'
export type { BackoffOptions } from './client/backoff'
export {
  RealtimeConnection,
  REALTIME_STATE_KEY,
  RISK_SIGNAL_EVENTS,
  RESYNC_EVENT,
  useRealtimeState,
} from './client/realtime'
export type {
  RealtimeState,
  RealtimeHandlers,
  RealtimeConnectionOptions,
  RiskSignal,
  ResyncReason,
} from './client/realtime'
