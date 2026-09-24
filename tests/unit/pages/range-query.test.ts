import { describe, expect, it } from 'vitest'
import { parseRangeQuery, rangeToQuery } from '@/pages/analytics/model/range-query'

describe('окно аналитики в адресе', () => {
  it('полная корректная пара принимается, отсутствие пары — окно по умолчанию', () => {
    expect(parseRangeQuery({ from: '2026-09-01', to: '2026-09-24' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-24',
    })
    expect(parseRangeQuery({})).toBeNull()
    expect(parseRangeQuery({ from: ['2026-09-01'], to: '2026-09-24' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-24',
    })
  })

  it('неполная или неверная пара сохраняется как есть, чтобы показать ошибку, а не молча сбросить', () => {
    expect(parseRangeQuery({ from: '2026-09-01' })).toEqual({ from: '2026-09-01', to: '' })
    expect(parseRangeQuery({ from: 'вчера', to: '2026-09-24' })).toEqual({
      from: 'вчера',
      to: '2026-09-24',
    })
    expect(rangeToQuery({ from: '2026-09-01', to: '2026-09-24' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-24',
    })
  })
})
