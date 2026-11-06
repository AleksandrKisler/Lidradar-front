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

describe('фильтры Radar: окно «Фильтры» на узких экранах', () => {
  it('открывается по кнопке, применяет выбор сразу (закрытие по «Готово» проверяет e2e)', async () => {
    const wrapper = mount(RiskFilters, {
      props: { modelValue: {}, locations: [], variant: 'panel' },
      attachTo: document.body,
    })
    expect(document.body.textContent).not.toContain('Готово')
    await wrapper.get('button').trigger('click')
    const select = document.body.querySelector<HTMLSelectElement>('select')!
    select.value = 'CRITICAL'
    select.dispatchEvent(new Event('change'))
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ severity: 'CRITICAL' }])
    wrapper.unmount()
  })
})
