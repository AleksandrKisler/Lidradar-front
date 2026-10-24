/**
 * Время сообщений черновика — то же правило, что у сервера (`sandbox/domain.PlanTimeline`): последнее отправлено
 * за `tailMinutes` до отправки, каждое предыдущее — на свою паузу раньше следующего, без паузы — на секунду
 * раньше. Интерфейс показывает рассчитанное время до отправки, сервер считает его заново в момент отправки.
 */
import type { SandboxDirection } from './types'

export const MAX_MESSAGES_PER_BUILD = 30
export const MAX_HISTORY_MINUTES = 7 * 24 * 60
export const MAX_TEXT_LENGTH = 4000

/** Паузы перед сообщением, которые предлагает интерфейс. */
export const PAUSE_OPTIONS = [0, 10, 60, 180] as const
/** «После последнего сообщения прошло»: шаблоны используют сутки и пять суток. */
export const TAIL_OPTIONS = [0, 60, 180, 1440, 7200] as const

export interface DraftMessage {
  direction: SandboxDirection
  text: string
  pauseBeforeMinutes: number
}

const MINUTE = 60_000
const SECOND = 1000

/** Сколько минут занимает история черновика: паузы (кроме первой) и хвост. */
export function historyMinutes(messages: readonly DraftMessage[], tailMinutes: number): number {
  return messages.reduce(
    (total, message, index) =>
      index === 0 ? total : total + Math.max(message.pauseBeforeMinutes, 0),
    Math.max(tailMinutes, 0),
  )
}

/** Время каждого сообщения черновика относительно `now`. */
export function planTimeline(
  messages: readonly DraftMessage[],
  tailMinutes: number,
  now: Date,
): Date[] {
  const times = new Array<Date>(messages.length)
  let at = now.getTime() - Math.max(tailMinutes, 0) * MINUTE
  for (let index = messages.length - 1; index >= 0; index--) {
    times[index] = new Date(at)
    if (index > 0) {
      const pause = Math.max(messages[index]!.pauseBeforeMinutes, 0)
      at -= pause > 0 ? pause * MINUTE : SECOND
    }
  }
  return times
}

/** Причина, по которой черновик нельзя отправить, или `null`. */
export function draftProblem(
  messages: readonly DraftMessage[],
  tailMinutes: number,
): string | null {
  if (messages.length === 0) return 'Добавьте хотя бы одно сообщение'
  if (messages.length > MAX_MESSAGES_PER_BUILD)
    return `Не больше ${MAX_MESSAGES_PER_BUILD} сообщений в одной переписке`
  if (messages.some((message) => message.text.trim() === ''))
    return 'В черновике есть пустое сообщение'
  if (messages.some((message) => message.text.trim().length > MAX_TEXT_LENGTH))
    return `Сообщение длиннее ${MAX_TEXT_LENGTH} символов`
  if (historyMinutes(messages, tailMinutes) > MAX_HISTORY_MINUTES)
    return 'История не может уходить в прошлое дальше 7 суток'
  return null
}

/** «10 мин», «1 ч», «1 ч 30 мин», «1 сутки», «5 суток». */
export function formatPause(minutes: number): string {
  if (minutes <= 0) return 'нет'
  if (minutes % 1440 === 0) {
    const days = minutes / 1440
    return days === 1 ? '1 сутки' : `${days} суток`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} мин`
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}
