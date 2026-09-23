/**
 * Инвалидация после команд над риском (архитектура § 8): карточка, все
 * страницы ленты и сводка. Исход и смена этапа затрагивают ещё сделку и
 * аналитику, подтверждение оплаты — аналитику и итоги выручки, вердикт —
 * сделку (каскад `NOT_A_LEAD`), точность и аналитику. Локально состояние не
 * переписывается — применяется ответ сервера и повторное чтение.
 */
import type { QueryClient } from '@tanstack/vue-query'
import { tenantScope } from '@/shared/api'
import { riskKeys } from './radar-api'

export interface InvalidateRiskOptions {
  /** Команда изменила сделку (исход): инвалидировать и её с аналитикой. */
  opportunity?: boolean
  /** Подтверждена оплата: инвалидировать аналитику и итоги выручки. */
  revenue?: boolean
  /** Записан вердикт: каскад может закрыть сделку; меняются точность и аналитика. */
  feedback?: boolean
}

export async function invalidateRisk(
  queryClient: QueryClient,
  tenantId: string,
  riskId: string,
  options: InvalidateRiskOptions = {},
): Promise<void> {
  const scope = tenantScope(tenantId)
  const extra: (readonly unknown[])[] = []
  if (options.opportunity) extra.push([...scope, 'opportunity'], [...scope, 'analytics'])
  if (options.revenue) extra.push([...scope, 'analytics'], [...scope, 'revenue'])
  if (options.feedback) {
    extra.push([...scope, 'opportunity'], [...scope, 'precision'], [...scope, 'analytics'])
  }
  const targets: readonly (readonly unknown[])[] = [
    riskKeys.detail(tenantId, riskId),
    [...scope, 'risks'],
    [...scope, 'radar'],
    ...extra,
  ]
  await Promise.all(targets.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
