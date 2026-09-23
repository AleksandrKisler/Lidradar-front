/**
 * Доказательная цепочка для атрибуции `RECOVERED`: риск, действие и исход
 * одной сделки из снимка карточки. Без полной цепочки возвращённую выручку
 * заявить нельзя — сервер отклонит, а интерфейс не должен обещать.
 */
export interface EvidenceRecord {
  id: string
  label: string
  createdAt: string
}

export interface RevenueEvidence {
  riskId: string
  opportunityId: string
  /** Валюта сделки — значение по умолчанию для формы. */
  currency: string
  /** Потенциал сделки десятичной строкой API — подсказка суммы. */
  suggestedAmount: string | null
  /** Действия по риску по убыванию времени. */
  actions: EvidenceRecord[]
  /** Последний исход сделки. */
  outcome: EvidenceRecord | null
  timeZone: string
}

export function hasRecoveredEvidence(evidence: RevenueEvidence): boolean {
  return evidence.actions.length > 0 && evidence.outcome !== null
}
