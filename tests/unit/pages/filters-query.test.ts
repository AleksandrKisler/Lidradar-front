import { describe, expect, it } from 'vitest'
import { parseRiskFeedStatus, parseRiskFilters, riskFiltersToQuery } from '@/pages/radar'

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
    expect(parseRiskFilters({ riskType: 'UNFINISHED_AGREEMENT' })).toEqual({
      riskType: 'UNFINISHED_AGREEMENT',
    })
  })

  it('сериализует без пустых значений', () => {
    expect(riskFiltersToQuery({ severity: 'LOW' })).toEqual({ severity: 'LOW' })
    expect(riskFiltersToQuery({})).toEqual({})
  })

  it('вкладка статуса: только OPEN и ACKNOWLEDGED, остальное — общая лента', () => {
    expect(parseRiskFeedStatus({ status: 'OPEN' })).toBe('OPEN')
    expect(parseRiskFeedStatus({ status: 'ACKNOWLEDGED' })).toBe('ACKNOWLEDGED')
    expect(parseRiskFeedStatus({ status: 'ACTED' })).toBeNull()
    expect(parseRiskFeedStatus({ status: '<x>' })).toBeNull()
    expect(parseRiskFeedStatus({})).toBeNull()
    expect(riskFiltersToQuery({ severity: 'LOW' }, 'OPEN')).toEqual({
      severity: 'LOW',
      status: 'OPEN',
    })
  })
})
