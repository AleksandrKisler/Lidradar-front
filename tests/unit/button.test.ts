import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { UiButton } from '@/shared/ui'
it('disabled button prevents interaction', async () => {
  const wrapper = mount(UiButton, { props: { disabled: true }, slots: { default: 'Сохранить' } })
  await wrapper.trigger('click')
  expect(wrapper.emitted('click')).toBeUndefined()
  expect(wrapper.attributes('type')).toBe('button')
  wrapper.unmount()
})
