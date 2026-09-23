/**
 * Подтверждение выручки сделки.
 *
 * Событие и его единственная атрибуция записываются сервером одной
 * транзакцией по ключу идемпотентности: `201` — новое подтверждение, `200` —
 * повтор прежнего. Для `RECOVERED` сервер проверяет цепочку риск → действие →
 * исход той же сделки в окне 30 дней; клиент лишь подставляет идентификаторы
 * из снимка карточки.
 */
import { apiClient, tenantScope, unwrapWithStatus } from '@/shared/api'
import type { ConfirmRevenueRequest, RevenueConfirmation } from '../model/types'

export interface ConfirmedRevenue {
  confirmation: RevenueConfirmation
  /** Сервер вернул ранее сохранённое подтверждение по тому же ключу. */
  replayed: boolean
}

export const revenueKeys = {
  /** Префикс всех запросов выручки организации (итоги, история). */
  scope: (tenantId: string) => [...tenantScope(tenantId), 'revenue'] as const,
}

export async function confirmRevenue(
  tenantId: string,
  opportunityId: string,
  idempotencyKey: string,
  body: ConfirmRevenueRequest,
): Promise<ConfirmedRevenue> {
  const { data, status } = await unwrapWithStatus(
    apiClient.POST('/api/v1/opportunities/{opportunityId}/revenue', {
      params: {
        header: { 'X-Tenant-ID': tenantId, 'Idempotency-Key': idempotencyKey },
        path: { opportunityId },
      },
      body,
    }),
  )
  return { confirmation: data, replayed: status === 200 }
}
