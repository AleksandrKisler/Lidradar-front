import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { toRiskCard } from '@/entities/risk'
import RiskCard from '@/widgets/risk-feed/ui/RiskCard.vue'
import { riskDetailFixture } from '../fixtures/risk-detail'

describe('карточка риска в ленте', () => {
  it('показывает неизвестные услугу и сумму рядом с известным каналом', () => {
    const card = toRiskCard({
      ...riskDetailFixture,
      risk: {
        ...riskDetailFixture.risk,
        type: 'UNFINISHED_AGREEMENT',
        reason: 'Точка пока не подтвердила перенос записи',
      },
      opportunity: { ...riskDetailFixture.opportunity!, serviceId: null, potentialRevenue: null },
      service: null,
    })
    const wrapper = mount(RiskCard, {
      props: { card, timeZone: 'Europe/Moscow', now: new Date('2026-09-18T10:00:00Z') },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(wrapper.text()).toContain('Договорённость требует внимания')
    expect(wrapper.text()).toContain('Услуга не уточнена · Telegram')
    expect(wrapper.text()).toContain('Сумма не определена')
    expect(wrapper.text()).toContain('Точка пока не подтвердила перенос записи')
    wrapper.unmount()
  })
})
