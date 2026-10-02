import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { serviceSchema } from '@/features/manage-services/model/schema'

const fields = { locationId: '', priceFrom: '', priceTo: '', currency: 'RUB' }

describe('название услуги: единый лимит символов Unicode', () => {
  it.each([
    'A'.repeat(200),
    'Я'.repeat(101),
    'Я'.repeat(200),
    '🚗'.repeat(200),
    'Я🚗'.repeat(100),
    'е\u0301'.repeat(100),
  ])('принимает допустимую длину: %s', (name) => {
    expect(v.parse(serviceSchema, { ...fields, name }).name).toBe(name)
  })

  it.each(['A'.repeat(201), 'Я'.repeat(201), '🚗'.repeat(201), 'е\u0301'.repeat(100) + 'Я'])(
    'отклоняет 201 символ: %s',
    (name) => {
      const result = v.safeParse(serviceSchema, { ...fields, name })
      expect(result.success).toBe(false)
      expect(result.issues?.[0]?.message).toBe('Не более 200 символов')
    },
  )

  it('считает длину после той же очистки пробелов, что и сервер', () => {
    const name = '\u0085' + 'Я'.repeat(99) + ' \t\u00a0\u2003 ' + 'Я'.repeat(100) + '\n'
    expect(v.parse(serviceSchema, { ...fields, name }).name).toBe(
      'Я'.repeat(99) + ' ' + 'Я'.repeat(100),
    )
  })

  it.each(['', ' \t\u0085\u00a0\u2003 '])('не принимает пустое название: %s', (name) => {
    const result = v.safeParse(serviceSchema, { ...fields, name })
    expect(result.success).toBe(false)
    expect(result.issues?.[0]?.message).toBe('Введите название услуги')
  })
})
