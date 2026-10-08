import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RadarSummary from '@/widgets/radar-summary/ui/RadarSummary.vue'

const summary = {
  openRisks: 3,
  criticalRisks: 0,
  potentialRevenue: '1000.00',
  confirmedRecoveredRevenue: '0.00',
  opportunitiesAtRisk: 2,
  opportunitiesWithUnknownAmount: 1,
}

describe('Radar summary unknown amounts', () => {
  it('shows known potential beside the number of unpriced deals', () => {
    const wrapper = mount(RadarSummary, {
      props: { summary, currency: 'RUB', loading: false, error: null },
    })
    expect(wrapper.text()).toContain('сделок без суммы: 1')
    expect(wrapper.text()).toMatch(/1\s*000/)
    wrapper.unmount()
  })

  it('shows the known amount with a "+ ?" marker instead of a bare zero', () => {
    const wrapper = mount(RadarSummary, {
      props: {
        summary: { ...summary, potentialRevenue: '0.00', opportunitiesWithUnknownAmount: 2 },
        currency: 'RUB',
        loading: false,
        error: null,
      },
    })
    expect(wrapper.text()).not.toContain('Сумма не определена')
    expect(wrapper.text()).toMatch(/0\s*₽\s*\+\s*\?/)
    expect(wrapper.text()).toContain('сделок без суммы: 2')
    wrapper.unmount()
  })

  it('preserves an explicitly known zero', () => {
    const wrapper = mount(RadarSummary, {
      props: {
        summary: { ...summary, potentialRevenue: '0.00', opportunitiesWithUnknownAmount: 0 },
        currency: 'RUB',
        loading: false,
        error: null,
      },
    })
    expect(wrapper.text()).not.toMatch(/\+\s*\?/)
    expect(wrapper.text()).toMatch(/0\s*₽/)
    wrapper.unmount()
  })
})
