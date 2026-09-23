/** Схема формы создания организации по ограничениям контракта. */
import * as v from 'valibot'

export const createOrganizationSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Введите название компании'),
    v.maxLength(200, 'Слишком длинное название'),
  ),
  defaultTimezone: v.pipe(v.string(), v.nonEmpty('Выберите часовой пояс')),
  defaultCurrency: v.pipe(v.string(), v.regex(/^[A-Za-z]{3}$/, 'Выберите валюту')),
})

export type CreateOrganizationValues = v.InferOutput<typeof createOrganizationSchema>
