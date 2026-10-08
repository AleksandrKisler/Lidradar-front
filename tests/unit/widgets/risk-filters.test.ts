import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { RiskFilters } from '@/widgets/risk-feed'

describe('фильтр типов риска', () => {
  it('предлагает незавершённые договорённости и передаёт выбранный тип', async () => {
    const wrapper = mount(RiskFilters, { props: { modelValue: {}, locations: [] } })
    const selector = wrapper
      .findAll('select')
      .find((item) => item.text().includes('Договорённость'))!
    expect(selector.text()).toContain('Договорённость требует внимания')
    await selector.setValue('UNFINISHED_AGREEMENT')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { riskType: 'UNFINISHED_AGREEMENT' },
    ])
    wrapper.unmount()
  })
})
