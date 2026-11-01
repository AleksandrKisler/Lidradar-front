import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UiTooltip from '@/shared/ui/UiTooltip.vue'

afterEach(() => {
  document.body.innerHTML = ''
})
describe('tooltip Escape ownership', () => {
  for (const hidden of [false, true]) {
    it(
      hidden
        ? 'lets the active dialog handle Escape when its anchor is behind it'
        : 'dismisses the active tooltip before its surrounding dialog',
      async () => {
        const host = document.createElement('div')
        document.body.append(host)
        const wrapper = mount(UiTooltip, {
          props: { text: 'History is retained' },
          slots: { default: '<button>Help</button>' },
          attachTo: host,
        })
        try {
          await wrapper.get('button').trigger('focusin')
          expect(document.querySelector('[role=tooltip]')).not.toBeNull()
          if (hidden) host.setAttribute('aria-hidden', 'true')
          const event = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          })
          window.dispatchEvent(event)
          await wrapper.vm.$nextTick()
          expect(event.defaultPrevented).toBe(!hidden)
          expect(document.querySelector('[role=tooltip]')).toBeNull()
        } finally {
          wrapper.unmount()
        }
      },
    )
  }
})
