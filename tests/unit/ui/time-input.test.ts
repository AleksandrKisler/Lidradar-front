import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { UiInput } from '@/shared/ui'

describe('24-hour time input', () => {
  it('renders the literal HH:mm value without an OS-localized time control', () => {
    const wrapper = mount(UiInput, { props: { type: 'time', modelValue: '21:45' } })
    const input = wrapper.get<HTMLInputElement>('input')
    expect(input.element.type).toBe('text')
    expect(input.element.value).toBe('21:45')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('placeholder')).toBe('ЧЧ:ММ')
    wrapper.unmount()
  })

  it('inserts the separator for a numeric keyboard and keeps the caret after the typed digit', async () => {
    const wrapper = mount(UiInput, { props: { type: 'time', modelValue: '' } })
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.value = '235'
    input.element.setSelectionRange(3, 3)
    await input.trigger('input')
    expect(input.element.value).toBe('23:5')
    expect(input.element.selectionStart).toBe(4)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['23:5'])
    await input.setValue('2359')
    expect(input.element.value).toBe('23:59')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['23:59'])
    await input.setValue('00:00')
    expect(input.element.value).toBe('00:00')
    wrapper.unmount()
  })

  it('preserves invalid ranges and 12-hour paste for form validation instead of changing their meaning', async () => {
    const wrapper = mount(UiInput, { props: { type: 'time' } })
    for (const value of ['25:00', '09:00 PM', '23:6', '']) {
      await wrapper.get('input').setValue(value)
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([value])
    }
    wrapper.unmount()
  })

  it('preserves input type, editing and attributes for ordinary fields', async () => {
    const wrapper = mount(UiInput, {
      props: { type: 'email', inputmode: 'email', placeholder: 'Почта', autocomplete: 'email' },
    })
    const input = wrapper.get<HTMLInputElement>('input')
    await input.setValue('owner@example.test')
    expect(input.element.type).toBe('email')
    expect(input.attributes('inputmode')).toBe('email')
    expect(input.attributes('placeholder')).toBe('Почта')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['owner@example.test'])
    wrapper.unmount()
  })
})
