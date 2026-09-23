/**
 * Команды рабочего пространства риска.
 *
 * Взятие в работу, закрытие и рекомендация идемпотентны на сервере сами по
 * себе. Действие и исход — append-only записи, поэтому отправляются с
 * ключом идемпотентности: `201` означает первую запись, `200` — повтор
 * прежнего результата. Исход принадлежит сделке (`opportunityId` из
 * карточки), но записывается из того же рабочего пространства.
 */
import { apiClient, unwrap, unwrapWithStatus } from '@/shared/api'
import type {
  Action,
  ActionType,
  Outcome,
  OutcomeStatus,
  Recommendation,
  Risk,
  RiskFeedback,
  RiskFeedbackRequest,
} from '../model/types'

export interface ActionDraft {
  type: ActionType
  note?: string
}

export interface OutcomeDraft {
  status: OutcomeStatus
  note?: string
}

export interface RecordedAction {
  action: Action
  /** Сервер вернул ранее сохранённый результат по тому же ключу. */
  replayed: boolean
}

export interface RecordedOutcome {
  outcome: Outcome
  replayed: boolean
}

export function acknowledgeRisk(tenantId: string, riskId: string): Promise<Risk> {
  return unwrap(
    apiClient.POST('/api/v1/risks/{riskId}/acknowledge', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskId } },
    }),
  )
}

export function resolveRisk(tenantId: string, riskId: string): Promise<Risk> {
  return unwrap(
    apiClient.POST('/api/v1/risks/{riskId}/resolve', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskId } },
    }),
  )
}

/** Создать или получить шаблонную рекомендацию (без обращения к AI). */
export function ensureRecommendation(tenantId: string, riskId: string): Promise<Recommendation> {
  return unwrap(
    apiClient.POST('/api/v1/risks/{riskId}/recommendation', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskId } },
    }),
  )
}

export async function createAction(
  tenantId: string,
  riskId: string,
  idempotencyKey: string,
  draft: ActionDraft,
): Promise<RecordedAction> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/risks/{riskId}/actions', {
      params: {
        header: { 'X-Tenant-ID': tenantId, 'Idempotency-Key': idempotencyKey },
        path: { riskId },
      },
      body: { type: draft.type, ...(draft.note ? { note: draft.note } : {}) },
    }),
  )
  return { action: data, replayed: status === 200 }
}

export async function createOutcome(
  tenantId: string,
  opportunityId: string,
  idempotencyKey: string,
  draft: OutcomeDraft,
): Promise<RecordedOutcome> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/opportunities/{opportunityId}/outcomes', {
      params: {
        header: { 'X-Tenant-ID': tenantId, 'Idempotency-Key': idempotencyKey },
        path: { opportunityId },
      },
      body: { status: draft.status, ...(draft.note ? { note: draft.note } : {}) },
    }),
  )
  return { outcome: data, replayed: status === 200 }
}

/**
 * Вердикт по риску — append-only факт со снимком риска и сделки. Ложное
 * срабатывание закрывает активный риск, причина `NOT_A_LEAD` дополнительно
 * закрывает сделку как потерянную; оба каскада выполняет сервер.
 */
export function recordRiskFeedback(
  tenantId: string,
  riskId: string,
  body: RiskFeedbackRequest,
): Promise<RiskFeedback> {
  return unwrap(
    apiClient.POST('/api/v1/risks/{riskId}/feedback', {
      params: { header: { 'X-Tenant-ID': tenantId }, path: { riskId } },
      body,
    }),
  )
}
