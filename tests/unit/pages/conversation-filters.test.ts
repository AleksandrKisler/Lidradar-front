import { describe, expect, it } from 'vitest'
import { conversationFiltersToQuery, parseConversationFilters } from '@/pages/conversations'

describe('фильтры переписок в адресе', () => {
  it('принимает известные значения и обрезает поиск', () => {
    const long = 'а'.repeat(120)
    expect(
      parseConversationFilters({
        search: ` ${long} `,
        withRisk: 'true',
        locationId: '01990000-0000-7000-8000-000000000201',
        connectionId: 'not-a-uuid',
        status: 'ARCHIVED',
      }),
    ).toEqual({
      search: 'а'.repeat(100),
      withRisk: true,
      locationId: '01990000-0000-7000-8000-000000000201',
      status: 'ARCHIVED',
    })
    expect(parseConversationFilters({ withRisk: 'yes', status: 'DELETED', search: '' })).toEqual({})
    expect(parseConversationFilters({ search: ['Дима', 'Лена'] })).toEqual({ search: 'Дима' })
  })

  it('сериализует без пустых значений', () => {
    expect(conversationFiltersToQuery({ search: 'Дима', withRisk: true })).toEqual({
      search: 'Дима',
      withRisk: 'true',
    })
    expect(conversationFiltersToQuery({ withRisk: false, search: '' })).toEqual({})
  })
})
