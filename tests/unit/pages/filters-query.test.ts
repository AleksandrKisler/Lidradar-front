import { describe, expect, it } from 'vitest'
import { parseRiskFilters, riskFiltersToQuery } from '@/pages/radar'

describe('фильтры Radar в query-строке', () => {
  it('принимает только известные значения', () => {
    expect(
      parseRiskFilters({
        severity: 'HIGH',
        riskType: 'NO_RESPONSE',
        locationId: '01990000-0000-7000-8000-000000000201',
      }),
    ).toEqual({
      severity: 'HIGH',
      riskType: 'NO_RESPONSE',
      locationId: '01990000-0000-7000-8000-000000000201',
    })
    expect(parseRiskFilters({ severity: 'ULTRA', riskType: '<script>', locationId: 'x' })).toEqual(
      {},
    )
    expect(parseRiskFilters({ severity: ['LOW', 'HIGH'], riskType: null })).toEqual({
      severity: 'LOW',
    })
  })

  it('сериализует без пустых значений', () => {
    expect(riskFiltersToQuery({ severity: 'LOW' })).toEqual({ severity: 'LOW' })
    expect(riskFiltersToQuery({})).toEqual({})
  })
})
