/**
 * Схема формы «Подтвердить оплату». Сумма проверяется как ввод человека
 * (`parseAmount`), связь с риском — по контракту; для `RECOVERED` нужно
 * выбранное действие. Флажок подтверждения обязателен: запись неизменяема.
 */
import * as v from 'valibot'
import { parseAmount } from '@/shared/lib'
import { ATTRIBUTION_TYPES } from '@/entities/revenue'

export const confirmRevenueSchema = v.pipe(
  v.object({
    amount: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('Укажите сумму'),
      v.check(
        (value) => parseAmount(value) !== null,
        'Сумма — положительное число, не более двух знаков после запятой',
      ),
    ),
    currency: v.pipe(v.string(), v.regex(/^[A-Za-z]{3}$/, 'Код валюты — три буквы')),
    attributionType: v.pipe(
      v.string(),
      v.check(
        (value) => (ATTRIBUTION_TYPES as readonly string[]).includes(value),
        'Выберите связь с риском',
      ),
    ),
    actionId: v.string(),
    confirmed: v.pipe(
      v.boolean(),
      v.check((value) => value, 'Подтвердите, что оплата получена'),
    ),
  }),
  v.forward(
    v.check(
      (values) => values.attributionType !== 'RECOVERED' || values.actionId !== '',
      'Выберите действие, после которого клиент оплатил',
    ),
    ['actionId'],
  ),
)

export type ConfirmRevenueValues = v.InferOutput<typeof confirmRevenueSchema>
