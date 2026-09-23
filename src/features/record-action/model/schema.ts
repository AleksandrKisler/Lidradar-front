/**
 * Схема формы «Записать действие». Тип хранится строкой, чтобы поле формы
 * напрямую связывалось с `<select>`; допустимые значения — ручные типы из
 * контракта. Заметка ограничена длиной из OpenAPI.
 */
import * as v from 'valibot'
import { MANUAL_ACTION_TYPES } from '@/entities/risk'

export const NOTE_MAX_LENGTH = 2000

export const recordActionSchema = v.object({
  type: v.pipe(
    v.string(),
    v.check(
      (value) => (MANUAL_ACTION_TYPES as readonly string[]).includes(value),
      'Выберите, что было сделано',
    ),
  ),
  note: v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(NOTE_MAX_LENGTH, `Не длиннее ${NOTE_MAX_LENGTH} символов`),
  ),
})

export type RecordActionValues = v.InferOutput<typeof recordActionSchema>
