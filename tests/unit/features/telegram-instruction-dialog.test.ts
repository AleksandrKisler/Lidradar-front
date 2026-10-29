import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import TelegramInstructionDialog from '@/features/connect-channel/ui/TelegramInstructionDialog.vue'
import { GUIDE_JUMPS, GUIDE_STEPS } from '@/features/connect-channel/model/guide-steps'

const dialog = () => new DOMWrapper(document.body).get('[role="dialog"]')

describe('окно «Подробная инструкция»', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('содержит шестнадцать шагов со скриншотами и четыре быстрых перехода к существующим шагам', async () => {
    const wrapper = mount(TelegramInstructionDialog, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    expect(GUIDE_STEPS).toHaveLength(16)
    expect(dialog().findAll('ol > li')).toHaveLength(16)
    expect(dialog().text()).toContain('Подключение бота')
    for (const jump of GUIDE_JUMPS) {
      expect(dialog().find(`#guide-step-${jump.step}`).exists()).toBe(true)
    }
    // У каждого шага есть оба слоя скриншота и подпись для чтения с экрана.
    const first = dialog().get('#guide-step-1')
    expect(first.findAll('img')).toHaveLength(2)
    expect(first.get('button').attributes('aria-label')).toBe('Увеличить скриншот шага 1')
    wrapper.unmount()
  })

  it('клик по скриншоту открывает его крупнее, «Закрыть» возвращает к списку', async () => {
    const wrapper = mount(TelegramInstructionDialog, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    await dialog().get('#guide-step-2 button').trigger('click')
    await flushPromises()
    const titles = [...document.querySelectorAll('[role="dialog"] h2')].map(
      (node) => node.textContent,
    )
    expect(titles).toContain('Шаг 2. Найдите BotFather')
    const close = [...document.querySelectorAll('button')].find(
      (node) => node.textContent === 'Закрыть',
    )
    close?.click()
    await flushPromises()
    expect(
      [...document.querySelectorAll('[role="dialog"] h2')].map((node) => node.textContent),
    ).not.toContain('Шаг 2. Найдите BotFather')
    wrapper.unmount()
  })

  it('«Вернуться к подключению» закрывает окно', async () => {
    const wrapper = mount(TelegramInstructionDialog, {
      props: { open: true },
      attachTo: document.body,
    })
    await flushPromises()
    const back = dialog()
      .findAll('button')
      .find((button) => button.text() === 'Вернуться к подключению')!
    await back.trigger('click')
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})
