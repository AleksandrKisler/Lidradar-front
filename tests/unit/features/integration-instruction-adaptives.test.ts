import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import TelegramInstructionDialog from '@/features/connect-channel/ui/TelegramInstructionDialog.vue'
import { GUIDE_JUMPS } from '@/features/connect-channel/model/guide-steps'
import {
  MOBILE_GUIDE_STEPS,
  TABLET_GUIDE_STEPS,
} from '@/features/connect-channel/model/mobile-guide-steps'

const body = () => new DOMWrapper(document.body)
const list = () => body().get('ol')
const originalWidth = window.innerWidth
const mounted: VueWrapper[] = []
function resize(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}
async function open(width: number, adaptive?: boolean) {
  resize(width)
  const wrapper = mount(TelegramInstructionDialog, {
    props: { open: true, ...(adaptive === undefined ? {} : { adaptive }) },
    attachTo: document.body,
  })
  mounted.push(wrapper)
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('ol')).not.toBeNull())
  if (adaptive && width < 1024) {
    await vi.waitFor(() => expect(body().find('[data-guide-illustration]').exists()).toBe(true))
  }
  return wrapper
}
const buttonByText = (text: string) =>
  body()
    .findAll('button')
    .find((button) => button.text() === text)!

describe('инструкция интеграций: opt-in approved adaptives', () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    resize(originalWidth)
    vi.restoreAllMocks()
  })

  it.each([undefined, false])(
    'default adaptive=%s сохраняет macOS на mobile и все 16 шагов',
    async (adaptive) => {
      await open(390, adaptive)
      expect(list().attributes('data-guide-platform')).toBe('macOS')
      expect(list().findAll(':scope > li')).toHaveLength(16)
      expect(body().text()).toContain('16 шагов в Telegram для macOS')
      expect(list().get('#guide-step-1').text()).toContain('Dock macOS')
      expect(list().get('#guide-step-15').text()).toContain('Нажмите «Готово»')
      expect(list().get('#guide-step-1').findAll('img')).toHaveLength(2)
      expect(list().get('#guide-step-1 img').attributes('src')).toContain('/guide/step-01.png')
      expect(body().find('[data-guide-illustration]').exists()).toBe(false)
      expect(body().find('.guide-nav--adaptive').exists()).toBe(false)
    },
  )

  it('iPhone показывает точные 16 действий, только активные phone images и native форму завершения', async () => {
    await open(390, true)
    expect(MOBILE_GUIDE_STEPS).toHaveLength(16)
    expect(list().attributes('data-guide-platform')).toBe('iPhone')
    expect(list().attributes('data-guide-layout')).toBe('mobile')
    expect(body().text()).toContain('16 шагов · Telegram на iPhone')
    expect(list().findAll(':scope > li')).toHaveLength(16)
    for (let index = 0; index < 15; index++) {
      const step = list().get(`#guide-step-${index + 1}`)
      const image = step.get('img')
      expect(image.attributes('src')).toContain(
        `/guide-mobile/step-${String(index + 1).padStart(2, '0')}.png`,
      )
      expect(image.attributes('loading')).toBe('lazy')
      expect(step.get('button').attributes('aria-label')).toBe(
        `Увеличить скриншот шага ${index + 1}`,
      )
    }
    expect(list().get('#guide-step-3').text()).toContain('Нажмите Open')
    expect(list().get('#guide-step-15').text()).toContain(
      'Отдельной кнопки «Готово» на этом экране нет',
    )
    const last = list().get('#guide-step-16')
    expect(last.find('[data-guide-illustration="LidRadar"]').exists()).toBe(true)
    expect(last.text()).toContain('Название подключения')
    expect(last.text()).toContain('Токен бота')
    expect(last.find('input').exists()).toBe(false)
    expect(last.find('form').exists()).toBe(false)
    expect(list().find('img[src*="/guide/"]').exists()).toBe(false)
  })

  it('tablet использует iPad copy, четыре jump anchors и approved iPhone action15', async () => {
    await open(834, true)
    expect(TABLET_GUIDE_STEPS).toHaveLength(16)
    expect(list().attributes('data-guide-platform')).toBe('macOS')
    expect(list().attributes('data-guide-layout')).toBe('tablet')
    expect(body().text()).toContain('16 шагов · iPad. Временные кадры macOS; в шаге 15 — iPhone.')
    expect(list().get('#guide-step-1').text()).toContain('на главном экране iPad или в Dock')
    expect(list().get('#guide-step-1 img').attributes('src')).toContain('/guide/step-01.png')
    expect(list().get('#guide-step-15 img').attributes('src')).toContain(
      '/guide-mobile/step-15.png',
    )
    expect(list().get('#guide-step-15').text()).toContain(
      'На iPad настройки также отправляются стрелкой «Назад»',
    )
    expect(list().get('#guide-step-16').text()).toContain('планшетная форма LidRadar')
    expect(body().get('[role="dialog"]').attributes('style')).toContain('--sh: 1066px')
    const nav = body().get('nav[aria-label="Этапы инструкции"]')
    expect(nav.findAll('button')).toHaveLength(4)
    const scroll = vi.fn()
    for (const jump of GUIDE_JUMPS) {
      const target = list().get(`#guide-step-${jump.step}`).element
      Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: scroll })
      const control = nav.findAll('button').find((button) => button.text().includes(jump.label))!
      await control.trigger('click')
      expect(scroll).toHaveBeenLastCalledWith({ block: 'start' })
    }
    expect(scroll).toHaveBeenCalledTimes(4)
  })

  it('zoom использует phone illustration и при закрытии возвращает фокус к своему шагу', async () => {
    await open(390, true)
    const source = list().get('#guide-step-3 button')
    ;(source.element as HTMLElement).focus()
    await source.trigger('click')
    await flushPromises()
    const zoom = body().findAll('[role="dialog"]').at(-1)!
    expect(zoom.text()).toContain('Шаг 3. Нажмите Open')
    expect(zoom.get('img').attributes('src')).toContain('/guide-mobile/step-03.png')
    expect(zoom.get('img').attributes('loading')).toBe('eager')
    await buttonByText('Закрыть').trigger('click')
    await flushPromises()
    await vi.waitFor(() => expect(document.activeElement).toBe(source.element))
    expect(body().findAll('[role="dialog"]')).toHaveLength(1)
  })

  it('resize закрывает zoom и переключает платформу, desktop сохраняет прежний guide', async () => {
    await open(390, true)
    await list().get('#guide-step-15 button').trigger('click')
    await flushPromises()
    resize(834)
    await flushPromises()
    expect(body().findAll('[role="dialog"]')).toHaveLength(1)
    expect(list().attributes('data-guide-layout')).toBe('tablet')
    expect(list().get('#guide-step-15').text()).toContain('На iPad настройки')
    resize(1440)
    await flushPromises()
    expect(list().attributes('data-guide-layout')).toBe('desktop')
    expect(list().get('#guide-step-15').text()).toContain('Нажмите «Готово»')
    expect(body().find('[data-guide-illustration]').exists()).toBe(false)
    expect(list().get('#guide-step-1 img').attributes('src')).toContain('/guide/step-01.png')
  })

  it('«Вернуться к подключению» закрывает guide без собственной команды или reset формы', async () => {
    const wrapper = await open(320, true)
    await buttonByText('Вернуться к подключению').trigger('click')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    expect(wrapper.emitted()).not.toHaveProperty('submit')
  })
})
