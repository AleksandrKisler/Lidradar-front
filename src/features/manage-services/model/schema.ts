/**
 * Схема формы услуги. Цены вводятся как текст и нормализуются `parseAmount`;
 * пустая цена — «неизвестна» (`null`), а не ноль. Обе границы в одной валюте,
 * нижняя не выше верхней.
 */
import * as v from 'valibot'
import { parseAmount } from '@/shared/lib'
import { SERVICE_NAME_MAX_LENGTH } from '@/entities/service'

const price = v.pipe(
  v.string(),
  v.trim(),
  v.check((value) => value === '' || parseAmount(value) !== null, 'Цена — положительное число'),
)

export const serviceSchema = v.pipe(
  v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('Введите название услуги'),
      v.maxLength(SERVICE_NAME_MAX_LENGTH, 'Слишком длинное название'),
    ),
    locationId: v.string(),
    priceFrom: price,
    priceTo: price,
    currency: v.pipe(v.string(), v.regex(/^[A-Za-z]{3}$/, 'Выберите валюту')),
  }),
  v.forward(
    v.check((values) => {
      const from = parseAmount(values.priceFrom)
      const to = parseAmount(values.priceTo)
      return from === null || to === null || Number(from) <= Number(to)
    }, 'Нижняя граница не может быть выше верхней'),
    ['priceTo'],
  ),
)

export type ServiceValues = v.InferOutput<typeof serviceSchema>
