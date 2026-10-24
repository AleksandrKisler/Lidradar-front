/**
 * Представление рабочей области песочницы: лента сообщений с паузами, шаги «собрать → отправить → сверить»,
 * этапы обработки и тексты ошибок команд. Чистые функции без обращения к API.
 */
import { describeError, isApiError, type ApiErrorDescription } from '@/shared/api'
import {
  VERDICT_STAGES,
  formatPause,
  planTimeline,
  stageLabel,
  type DraftMessage,
  type SandboxConversation,
  type SandboxDirection,
  type SandboxVerdict,
} from '@/entities/sandbox'

export type TimelineItem =
  | {
      kind: 'message'
      key: string
      direction: SandboxDirection
      text: string
      at: Date
      /** Номер сообщения в черновике — для удаления; `null` у отправленных. */
      draftIndex: number | null
      /** Отправлено, но коннектор ещё не подтвердил. */
      sent: boolean
    }
  | { kind: 'gap'; key: string; label: string }

const MINUTE = 60_000

/** «прошло 25 мин», «прошло 3 ч», «прошло 2 суток» для произвольного промежутка. */
export function elapsedLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} ч`
  const days = Math.floor(minutes / 1440)
  return days === 1 ? '1 сутки' : `${days} суток`
}

/** Лента черновика: время из пауз, паузы — подписями между сообщениями. */
export function draftTimeline(
  messages: readonly DraftMessage[],
  tailMinutes: number,
  now: Date,
): TimelineItem[] {
  const times = planTimeline(messages, tailMinutes, now)
  const items: TimelineItem[] = []
  messages.forEach((message, index) => {
    if (index > 0 && message.pauseBeforeMinutes > 0)
      items.push({
        kind: 'gap',
        key: `gap-${index}`,
        label: `прошло ${formatPause(message.pauseBeforeMinutes)}`,
      })
    items.push({
      kind: 'message',
      key: `draft-${index}`,
      direction: message.direction,
      text: message.text,
      at: times[index]!,
      draftIndex: index,
      sent: false,
    })
  })
  return items
}

/** Лента отправленной переписки: промежутки от минуты и время с последнего сообщения до сейчас. */
export function sentTimeline(conversation: SandboxConversation, now: Date): TimelineItem[] {
  const items: TimelineItem[] = []
  let previous: Date | null = null
  for (const message of conversation.messages) {
    const at = new Date(message.sentAt)
    if (previous) {
      const minutes = Math.floor((at.getTime() - previous.getTime()) / MINUTE)
      if (minutes >= 1)
        items.push({
          kind: 'gap',
          key: `gap-${message.id}`,
          label: `прошло ${elapsedLabel(minutes)}`,
        })
    }
    items.push({
      kind: 'message',
      key: message.id,
      direction: message.direction,
      text: message.text,
      at,
      draftIndex: null,
      sent: true,
    })
    previous = at
  }
  if (previous) {
    const minutes = Math.floor((now.getTime() - previous.getTime()) / MINUTE)
    if (minutes >= 1)
      items.push({ kind: 'gap', key: 'gap-tail', label: `прошло ${elapsedLabel(minutes)}` })
  }
  return items
}

export type StepState = 'done' | 'now' | 'todo'

/** Шаги порядка: черновик — шаг 1; отправлено и обрабатывается — шаг 2; результат готов — шаг 3. */
export function stepStates(verdict: SandboxVerdict | null): [StepState, StepState, StepState] {
  if (!verdict) return ['now', 'todo', 'todo']
  if (verdict.state === 'PROCESSING') return ['done', 'now', 'todo']
  return ['done', 'done', 'now']
}

export interface StageProgress {
  percent: number
  items: { stage: string; label: string; state: StepState }[]
}

/** Шкала этапов обработки для состояния PROCESSING. */
export function stageProgress(verdict: SandboxVerdict): StageProgress {
  const current = verdict.stage ? VERDICT_STAGES.indexOf(verdict.stage) : 0
  return {
    percent: Math.round((Math.max(current, 0) / VERDICT_STAGES.length) * 100),
    items: VERDICT_STAGES.map((stage, index) => ({
      stage,
      label: stageLabel(stage),
      state: index < current ? 'done' : index === current ? 'now' : 'todo',
    })),
  }
}

const SANDBOX_ERRORS: Record<string, ApiErrorDescription> = {
  SANDBOX_BUSY: {
    title: 'Другая переписка ещё обрабатывается',
    description:
      'В организации одновременно обрабатывается одна переписка песочницы. Дождитесь её результата.',
  },
  SANDBOX_AI_BUSY: {
    title: 'Очередь AI занята',
    description: 'AI-узел общий с рабочей системой. Повторите отправку через минуту.',
  },
  SANDBOX_LIMIT: {
    title: 'Суточный лимит исчерпан',
    description:
      'Организация отправила максимум переписок или сообщений за сутки. Продолжите позже.',
  },
  SANDBOX_CHANNEL_DISCONNECTED: {
    title: 'Канал песочницы отключён',
    description: 'Владелец отключил канал «Песочница» в интеграциях. Создайте нового клиента.',
  },
  SANDBOX_DELIVERY_UNAVAILABLE: {
    title: 'Не все сообщения дошли',
    description:
      'Переписка сохранена. Повторите отправку — недоставленные сообщения уйдут без дублей.',
  },
}

/** Текст ошибки команды песочницы; остальные коды — общими подписями. */
export function sandboxErrorText(error: unknown): ApiErrorDescription {
  if (isApiError(error) && error.code && SANDBOX_ERRORS[error.code])
    return SANDBOX_ERRORS[error.code]!
  return describeError(error)
}

/** Подпись стороны, чей ответ закрывает ожидаемый риск. */
export function closedByText(closedBy: SandboxDirection | null | undefined): string {
  if (closedBy === 'INCOMING') return 'Риск закроется, когда ответит клиент.'
  if (closedBy === 'OUTGOING') return 'Риск закроется, когда ответит бизнес.'
  return 'Ожидаемый риск не задан: песочница покажет всё, что найдёт Radar.'
}
