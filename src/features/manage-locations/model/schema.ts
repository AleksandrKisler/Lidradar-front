/** Схема формы точки: название, пояс и порог ответа в минутах (1..1440). */
import * as v from 'valibot'
import { RESPONSE_THRESHOLD_MAX, RESPONSE_THRESHOLD_MIN } from '@/entities/location'

export const locationSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите название точки'),
    v.maxLength(200, 'Слишком длинное название'),
  ),
  timezone: v.pipe(v.string(), v.nonEmpty('Выберите часовой пояс')),
  responseThresholdMinutes: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,4}$/, 'Порог — целое число минут'),
    v.check((value) => {
      const minutes = Number(value)
      return minutes >= RESPONSE_THRESHOLD_MIN && minutes <= RESPONSE_THRESHOLD_MAX
    }, `От ${RESPONSE_THRESHOLD_MIN} до ${RESPONSE_THRESHOLD_MAX} минут`),
  ),
  active: v.boolean(),
})

export type LocationValues = v.InferOutput<typeof locationSchema>
