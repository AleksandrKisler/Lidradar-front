import { describe, expect, it } from 'vitest'
import {
  filtersToQuery,
  parseIdPair,
  parseJobFilters,
  parseLimit,
  parseRunFilters,
} from '@/pages/admin/model/filters-query'

const TENANT = '01990000-0000-7000-8000-000000000001'

describe('фильтры admin-списков из адреса', () => {
  it('принимает только известные статусы, UUID и допустимые лимиты', () => {
    expect(
      parseJobFilters({ status: 'DEAD', tenantId: TENANT, type: 'risk.detect', limit: '200' }),
    ).toEqual({ limit: 200, tenantId: TENANT, status: 'DEAD', type: 'risk.detect' })
    expect(
      parseJobFilters({ status: 'BOGUS', tenantId: 'not-uuid', type: 'x y', limit: '7' }),
    ).toEqual({ limit: 50 })
    expect(parseLimit({ limit: ['100'] })).toBe(100)
    expect(parseRunFilters({ status: 'FAILED', applicationStatus: 'STALE' })).toEqual({
      limit: 50,
      status: 'FAILED',
      applicationStatus: 'STALE',
    })
    expect(parseRunFilters({ applicationStatus: 'NOPE' })).toEqual({ limit: 50 })
  })

  it('сериализует непустые фильтры и опускает лимит по умолчанию', () => {
    expect(filtersToQuery({ status: 'DEAD', tenantId: undefined, limit: 50, type: '' })).toEqual({
      status: 'DEAD',
    })
    expect(filtersToQuery({ limit: 200 })).toEqual({ limit: '200' })
  })

  it('пара идентификаторов принимается только целиком и только как UUID', () => {
    expect(parseIdPair({ tenantId: TENANT, messageId: TENANT }, 'tenantId', 'messageId')).toEqual({
      tenantId: TENANT,
      messageId: TENANT,
    })
    expect(parseIdPair({ tenantId: TENANT }, 'tenantId', 'messageId')).toBeNull()
    expect(parseIdPair({ tenantId: TENANT, messageId: 'x' }, 'tenantId', 'messageId')).toBeNull()
  })
})
