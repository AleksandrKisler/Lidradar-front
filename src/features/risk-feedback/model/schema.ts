/**
 * Схема формы вердикта. Причина обязательна только для ложного срабатывания;
 * заметка ограничена длиной из контракта.
 */
import * as v from 'valibot'
import { FEEDBACK_REASONS, RISK_VERDICTS } from '@/entities/risk'

export const FEEDBACK_NOTE_MAX_LENGTH = 1000

export const riskFeedbackSchema = v.pipe(
  v.object({
    verdict: v.pipe(
      v.string(),
      v.check((value) => (RISK_VERDICTS as readonly string[]).includes(value), 'Выберите оценку'),
    ),
    reason: v.string(),
    note: v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(FEEDBACK_NOTE_MAX_LENGTH, `Не длиннее ${FEEDBACK_NOTE_MAX_LENGTH} символов`),
    ),
  }),
  v.forward(
    v.check(
      (values) =>
        values.verdict !== 'FALSE_POSITIVE' ||
        (FEEDBACK_REASONS as readonly string[]).includes(values.reason),
      'Укажите причину ложного срабатывания',
    ),
    ['reason'],
  ),
)

export type RiskFeedbackValues = v.InferOutput<typeof riskFeedbackSchema>
