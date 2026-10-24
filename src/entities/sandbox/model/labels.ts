/**
 * Подписи сверки «Ожидали / Нашли» (ADR 0066 п. 6): короткая метка для списка, заголовок и пояснение для панели
 * «Проверка». Тексты не обещают того, чего сервер не говорил: срок риска — только из `dueAt`.
 */
import { dayKey, formatDay, formatTime } from '@/shared/lib'
import type { SandboxVerdict, VerdictStage, VerdictState } from './types'

export type VerdictTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

/** Порядок этапов обработки — для шкалы прогресса. */
export const VERDICT_STAGES: readonly VerdictStage[] = [
  'SENDING',
  'NORMALIZING',
  'ANALYZING',
  'EVALUATING',
]

const STAGE_LABELS: Record<VerdictStage, string> = {
  SENDING: 'Сообщения уходят в систему',
  NORMALIZING: 'Собирается переписка',
  ANALYZING: 'AI читает переписку',
  EVALUATING: 'Radar проверяет правила',
}

export function stageLabel(stage: VerdictStage): string {
  return STAGE_LABELS[stage]
}

const BADGES: Record<VerdictState, { label: string; tone: VerdictTone }> = {
  PROCESSING: { label: 'Обработка', tone: 'brand' },
  MATCH: { label: 'Совпало', tone: 'success' },
  PENDING: { label: 'Ждёт', tone: 'warning' },
  CLOSED: { label: 'Риск закрыт', tone: 'success' },
  MISMATCH: { label: 'Не совпало', tone: 'danger' },
  NO_EXPECTATION: { label: 'Без ожидания', tone: 'neutral' },
  FAILED: { label: 'Ошибка', tone: 'danger' },
}

/** Метка состояния в списке клиентов. */
export function verdictBadge(state: VerdictState): { label: string; tone: VerdictTone } {
  return BADGES[state]
}

/** «Сегодня, 10:20», «Завтра, 10:20» в поясе организации: срок риска чаще всего наступает на следующий день. */
export function formatMoment(
  value: string | Date,
  timeZone: string,
  now: Date = new Date(),
): string {
  const tomorrow = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone)
  const day = dayKey(value, timeZone) === tomorrow ? 'Завтра' : formatDay(value, timeZone, now)
  return `${day ?? ''}, ${formatTime(value, timeZone) ?? ''}`
}

export interface VerdictText {
  title: string
  description: string
}

/** Заголовок и пояснение результата для панели «Проверка». */
export function verdictText(
  verdict: SandboxVerdict,
  timeZone: string,
  now: Date = new Date(),
): VerdictText {
  switch (verdict.state) {
    case 'PROCESSING':
      return {
        title: verdict.stage ? stageLabel(verdict.stage) : 'Идёт обработка',
        description:
          verdict.stage === 'SENDING'
            ? 'Не все сообщения дошли до системы. Повторите отправку — недоставленные уйдут, дублей не будет.'
            : 'Обычно это занимает до минуты. Страница обновится сама.',
      }
    case 'MATCH':
      return {
        title: 'Совпало с ожиданием',
        description:
          'Radar нашёл ожидаемый риск. Проверьте карточку и попробуйте закрыть риск ответом.',
      }
    case 'PENDING':
      return {
        title: 'Риск ещё не наступил',
        description: verdict.dueAt
          ? `Порог считается в рабочих часах точки. Риск должен появиться ${formatMoment(verdict.dueAt, timeZone, now).toLowerCase()}.`
          : 'Порог считается в рабочих часах точки, проверка запланирована.',
      }
    case 'CLOSED':
      return {
        title: 'Риск закрыт',
        description:
          'Radar нашёл ожидаемый риск и закрыл его после нового сообщения. Сценарий пройден.',
      }
    case 'MISMATCH':
      return {
        title: 'Не совпало',
        description:
          'Обработка завершена, ожидаемого риска нет. Повторите шаблон один раз; если снова не совпало, заведите баг по руководству тестировщика.',
      }
    case 'NO_EXPECTATION':
      return {
        title: 'Ожидание не задано',
        description: 'Посмотрите, что нашёл Radar, и сравните с тем, что ожидали сами.',
      }
    case 'FAILED':
      return {
        title: 'Обработка завершилась ошибкой',
        description: verdict.failureCode
          ? `Код ошибки: ${verdict.failureCode}. Заведите баг по руководству тестировщика.`
          : 'Заведите баг по руководству тестировщика.',
      }
  }
}
