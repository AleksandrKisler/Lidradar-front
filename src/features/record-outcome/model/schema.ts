/** Схема формы «Записать исход»: статус из контракта и заметка до 2000 символов. */
import * as v from 'valibot'
import { OUTCOME_STATUSES } from '@/entities/risk'

export const NOTE_MAX_LENGTH = 2000

export const recordOutcomeSchema = v.object({
  status: v.pipe(
    v.string(),
    v.check(
      (value) => (OUTCOME_STATUSES as readonly string[]).includes(value),
      'Выберите, чем ответил клиент',
    ),
  ),
  note: v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(NOTE_MAX_LENGTH, `Не длиннее ${NOTE_MAX_LENGTH} символов`),
  ),
})

export type RecordOutcomeValues = v.InferOutput<typeof recordOutcomeSchema>
