/**
 * Схема формы точки: название, пояс и пороги в минутах (1..1440). Тексты ошибок порогов —
 * US-M02-02, ветка B (B1–B3): одинаковые для обоих полей в мастере и в настройках.
 */
import * as v from 'valibot'
import {
  AGREEMENT_THRESHOLD_MAX,
  AGREEMENT_THRESHOLD_MIN,
  RESPONSE_THRESHOLD_MAX,
  RESPONSE_THRESHOLD_MIN,
} from '@/entities/location'

const THRESHOLD_FORMAT = 'Порог — целое число минут.'

export const locationSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите название точки.'),
    // Длина в символах, как в контракте: эмодзи и составные знаки считаются одним символом.
    v.check((name) => Array.from(name).length <= 200, 'Слишком длинное название'),
  ),
  timezone: v.pipe(v.string(), v.nonEmpty('Выберите часовой пояс')),
  responseThresholdMinutes: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,4}$/, THRESHOLD_FORMAT),
    v.check((value) => {
      const minutes = Number(value)
      return minutes >= RESPONSE_THRESHOLD_MIN && minutes <= RESPONSE_THRESHOLD_MAX
    }, `От ${RESPONSE_THRESHOLD_MIN} до ${RESPONSE_THRESHOLD_MAX} минут.`),
  ),
  agreementThresholdMinutes: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,4}$/, THRESHOLD_FORMAT),
    v.check((value) => {
      const minutes = Number(value)
      return minutes >= AGREEMENT_THRESHOLD_MIN && minutes <= AGREEMENT_THRESHOLD_MAX
    }, `От ${AGREEMENT_THRESHOLD_MIN} до ${AGREEMENT_THRESHOLD_MAX} минут.`),
  ),
  active: v.boolean(),
})

export type LocationValues = v.InferOutput<typeof locationSchema>
