/**
 * Этапы коммерческой возможности (§ 8 модели данных). Активная цепочка
 * линейна; интерфейс предлагает только разрешённые цели: любой следующий
 * активный этап или `LOST`, из `BOOKED` — `WON` или `LOST`, из закрытых —
 * только `ARCHIVED`. Назад, повторное открытие и преждевременный `WON` не
 * предлагаются; окончательное решение принимает сервер (`409`).
 */
import type { OpportunityStage, OpportunityStageSource } from './types'

export const ACTIVE_STAGE_ORDER: readonly OpportunityStage[] = [
  'NEW',
  'ENGAGED',
  'QUALIFYING',
  'PRICE_SENT',
  'WAITING_CUSTOMER',
  'WAITING_BUSINESS',
  'BOOKING_INTENT',
  'BOOKED',
]

export const TERMINAL_STAGES: readonly OpportunityStage[] = ['WON', 'LOST', 'ARCHIVED']

export function isActiveStage(stage: OpportunityStage | string): boolean {
  return (ACTIVE_STAGE_ORDER as readonly string[]).includes(stage)
}

/** Цели перехода в порядке цепочки; текущий этап не предлагается (повтор идемпотентен, но бессмыслен). */
export function allowedNextStages(stage: OpportunityStage | string): OpportunityStage[] {
  if (stage === 'BOOKED') return ['WON', 'LOST']
  if (stage === 'WON' || stage === 'LOST') return ['ARCHIVED']
  const index = ACTIVE_STAGE_ORDER.indexOf(stage as OpportunityStage)
  if (index === -1) return []
  return [...ACTIVE_STAGE_ORDER.slice(index + 1), 'LOST']
}

/** Закрывающие переходы требуют явного подтверждения: назад дороги нет. */
export function isClosingStage(stage: OpportunityStage | string): boolean {
  return (TERMINAL_STAGES as readonly string[]).includes(stage)
}

const sourceLabels: Record<OpportunityStageSource, string> = {
  RULE: 'Правило',
  AI: 'AI',
  USER: 'Вручную',
  IMPORT: 'Импорт',
}

export function stageSourceLabel(value: OpportunityStageSource | string): string {
  return sourceLabels[value as OpportunityStageSource] ?? value
}

/** Последствия закрывающего перехода для диалога подтверждения. */
export function describeClosingStage(stage: OpportunityStage): string {
  switch (stage) {
    case 'WON':
      return 'Возможность закроется как выигранная; вернуть её в работу нельзя. Оплата подтверждается отдельно, этот переход её не фиксирует.'
    case 'LOST':
      return 'Возможность закроется как потерянная; вернуть её в работу нельзя. Записанные риски, действия и исходы сохранятся.'
    case 'ARCHIVED':
      return 'Возможность уйдёт в архив без права на дальнейшие переходы.'
    default:
      return ''
  }
}
