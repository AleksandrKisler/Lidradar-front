/**
 * Адаптеры транспортной модели риска к моделям представления.
 *
 * Компоненты не читают `RiskDetail` напрямую: адаптер закрепляет запасные
 * подписи для отсутствующих связей («Без имени», «Сумма не указана») и
 * оставляет форматирование дат компоненту, которому известен часовой пояс.
 */
import { formatMoney } from '@/shared/lib'
import {
  actionTypeLabel,
  opportunityStageLabel,
  outcomeStatusLabel,
  riskSourceLabel,
  riskStatusLabel,
  riskStatusTone,
  riskTypeLabel,
  severityLabel,
  severityTone,
  type Tone,
} from './labels'
import { isActiveRiskStatus, type RiskDetail, type RiskStatus } from './types'

/** Подпись контакта, если имя неизвестно. */
export const UNNAMED_CONTACT = 'Без имени'

export interface RiskCardViewModel {
  id: string
  severity: RiskDetail['risk']['severity']
  severityLabel: string
  severityTone: Tone
  typeLabel: string
  statusLabel: string
  /** Причина риска — недоверенный текст, выводится только как текст. */
  reason: string
  contactName: string
  serviceName: string | null
  channelName: string | null
  /** Отформатированный потенциал сделки или `null`, если оценки нет. */
  potential: string | null
  currency: string | null
  dueAt: string
  detectedAt: string
  lastMessage: { preview: string | null; direction: string; sentAt: string } | null
  externalUrl: string | null
  externalUnavailableReason: string | null
  hasRecommendation: boolean
  actionsCount: number
  outcomeLabel: string | null
}

/** Запись истории рабочего пространства: действие или исход. */
export interface RiskHistoryEntry {
  id: string
  kind: 'action' | 'outcome'
  label: string
  createdAt: string
}

export interface RiskWorkspaceViewModel extends RiskCardViewModel {
  status: RiskStatus
  statusTone: Tone
  /** Активный риск известного статуса: только над ним доступны команды. */
  isActive: boolean
  reasonCode: string
  policyVersion: string
  sourceLabel: string
  /** Уверенность AI в долях единицы; у правил и ручных рисков её нет. */
  confidence: number | null
  opportunityId: string | null
  conversationId: string | null
  stageLabel: string | null
  serviceActive: boolean | null
  channelStatus: string | null
  recommendation: string | null
  /** Действия и исход по убыванию времени. */
  history: RiskHistoryEntry[]
  outcomeAt: string | null
  /** Деньги сделки с провенансом: потенциал и подтверждённо возвращённое. */
  money: { potential: string | null; confirmedRecovered: string | null; currency: string } | null
  /** Потенциал сделки десятичной строкой API — подсказка суммы для подтверждения оплаты. */
  potentialAmount: string | null
  acknowledgedAt: string | null
  actedAt: string | null
  resolvedAt: string | null
  updatedAt: string
}

/** Собирает модель карточки для ленты Radar и заголовка рабочего пространства. */
export function toRiskCard(detail: RiskDetail): RiskCardViewModel {
  const { risk, opportunity, contact, service, channel, conversation, externalLink } = detail
  const currency = opportunity?.currency ?? null
  return {
    id: risk.id,
    severity: risk.severity,
    severityLabel: severityLabel(risk.severity),
    severityTone: severityTone(risk.severity),
    typeLabel: riskTypeLabel(risk.type),
    statusLabel: riskStatusLabel(risk.status),
    reason: risk.reason,
    contactName: contact?.displayName?.trim() || UNNAMED_CONTACT,
    serviceName: service?.name ?? null,
    channelName: channel?.name ?? null,
    potential: currency ? formatMoney(opportunity?.potentialRevenue ?? null, currency) : null,
    currency,
    dueAt: risk.dueAt,
    detectedAt: risk.detectedAt,
    lastMessage: conversation?.lastMessage
      ? {
          preview: conversation.lastMessage.preview,
          direction: conversation.lastMessage.direction,
          sentAt: conversation.lastMessage.sentAt,
        }
      : null,
    externalUrl: externalLink.url,
    externalUnavailableReason: externalLink.unavailableReason,
    hasRecommendation: detail.recommendation !== null,
    actionsCount: detail.actions.length,
    outcomeLabel: detail.outcome ? outcomeStatusLabel(detail.outcome.type) : null,
  }
}

/** Полная модель рабочего пространства риска. */
export function toRiskWorkspace(detail: RiskDetail): RiskWorkspaceViewModel {
  const card = toRiskCard(detail)
  const { risk, opportunity, conversation, service, channel, revenue } = detail
  const history: RiskHistoryEntry[] = detail.actions.map((action) => ({
    id: action.id,
    kind: 'action',
    label: actionTypeLabel(action.type),
    createdAt: action.createdAt,
  }))
  if (detail.outcome) {
    history.push({
      id: detail.outcome.id,
      kind: 'outcome',
      label: outcomeStatusLabel(detail.outcome.type),
      createdAt: detail.outcome.createdAt,
    })
  }
  history.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const currency = revenue?.currency ?? opportunity?.currency ?? null
  return {
    ...card,
    status: risk.status,
    statusTone: riskStatusTone(risk.status),
    isActive: isActiveRiskStatus(risk.status),
    reasonCode: risk.reasonCode,
    policyVersion: risk.policyVersion,
    sourceLabel: riskSourceLabel(risk.source),
    confidence: risk.confidence ?? null,
    opportunityId: opportunity?.id ?? null,
    conversationId: conversation?.id ?? null,
    stageLabel: opportunity ? opportunityStageLabel(opportunity.stage) : null,
    serviceActive: service?.active ?? null,
    channelStatus: channel?.status ?? null,
    recommendation: detail.recommendation?.text ?? null,
    history,
    outcomeAt: detail.outcome?.createdAt ?? null,
    money: currency
      ? {
          potential: formatMoney(
            revenue?.potential ?? opportunity?.potentialRevenue ?? null,
            currency,
          ),
          confirmedRecovered: revenue ? formatMoney(revenue.confirmedRecovered, currency) : null,
          currency,
        }
      : null,
    potentialAmount: revenue?.potential ?? opportunity?.potentialRevenue ?? null,
    acknowledgedAt: risk.acknowledgedAt ?? null,
    actedAt: risk.actedAt ?? null,
    resolvedAt: risk.resolvedAt ?? null,
    updatedAt: risk.updatedAt,
  }
}
