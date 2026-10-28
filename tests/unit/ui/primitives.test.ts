import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { ApiError } from '@/shared/api'
import {
  UiAlert,
  UiButton,
  UiDialog,
  UiErrorState,
  UiField,
  UiInput,
  UiPasswordInput,
} from '@/shared/ui'

describe('UiButton', () => {
  it('в состоянии загрузки блокирует клики и объявляет занятость, сохраняя имя', async () => {
    const wrapper = mount(UiButton, { props: { loading: true }, slots: { default: 'Сохранить' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Сохранить')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.attributes('type')).toBe('button')
    wrapper.unmount()
  })
})

describe('UiField', () => {
  it('связывает подпись, описание и ошибку; ошибка заменяет описание только по параметру (формы Access)', () => {
    const mountField = (error: string, replace = false) =>
      mount(
        defineComponent({
          render() {
            return h(
              UiField,
              { label: 'Почта', description: 'Рабочая', error, errorReplacesDescription: replace },
              {
                default: (slot: { id: string; describedBy?: string; invalid: boolean }) =>
                  h(UiInput, slot),
              },
            )
          },
        }),
      )
    // Без ошибки: подпись и описание связаны, ошибки нет.
    const calm = mountField('')
    const calmInput = calm.get('input')
    const calmId = calmInput.attributes('id')!
    expect(calm.get('label').attributes('for')).toBe(calmId)
    expect(calmInput.attributes('aria-describedby')).toBe(`${calmId}-description`)
    expect(calmInput.attributes('aria-invalid')).toBeUndefined()
    expect(calm.get(`[id="${calmId}-description"]`).text()).toBe('Рабочая')
    calm.unmount()
    // По умолчанию подсказка остаётся рядом с ошибкой: она может нести смысл, которого нет в ошибке.
    const both = mountField('Неверно')
    const bothId = both.get('input').attributes('id')!
    expect(both.get('input').attributes('aria-describedby')).toBe(
      `${bothId}-description ${bothId}-error`,
    )
    expect(both.get(`[id="${bothId}-description"]`).text()).toBe('Рабочая')
    both.unmount()
    // Формы Access: текст ошибки заменяет описание и объявляется живой областью.
    const wrapper = mountField('Неверно', true)
    const input = wrapper.get('input')
    const id = input.attributes('id')!
    expect(wrapper.get('label').attributes('for')).toBe(id)
    expect(input.attributes('aria-describedby')).toBe(`${id}-error`)
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get(`[id="${id}-error"]`).text()).toBe('Неверно')
    expect(wrapper.find(`[id="${id}-description"]`).exists()).toBe(false)
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('UiPasswordInput', () => {
  it('переключает видимость и не меняет значение', async () => {
    const wrapper = mount(UiPasswordInput, { props: { modelValue: 'secret' } })
    expect(wrapper.get('input').attributes('type')).toBe('password')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('secret')
    wrapper.unmount()
  })
})

describe('UiAlert', () => {
  it('выбирает роль по тону и показывает идентификатор запроса', () => {
    const danger = mount(UiAlert, {
      props: { tone: 'danger', title: 'Ошибка', traceId: 'trace-9' },
      slots: { default: 'Текст' },
    })
    expect(danger.attributes('role')).toBe('alert')
    expect(danger.text()).toContain('trace-9')
    const info = mount(UiAlert, { props: { tone: 'info' }, slots: { default: 'Текст' } })
    expect(info.attributes('role')).toBe('status')
    danger.unmount()
    info.unmount()
  })
})

describe('UiErrorState', () => {
  it('объясняет ошибку по коду, даёт повтор и технические детали', async () => {
    const error = new ApiError({
      httpStatus: 503,
      code: 'SERVICE_NOT_READY',
      message: 'db down',
      traceId: 'trace-1',
    })
    const wrapper = mount(UiErrorState, { props: { error } })
    expect(wrapper.text()).toContain('Сервис недоступен')
    expect(wrapper.text()).not.toContain('db down')
    expect(wrapper.text()).toContain('SERVICE_NOT_READY')
    expect(wrapper.text()).toContain('trace-1')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })

  it('скрывает повтор и детали для неизвестной ошибки', () => {
    const wrapper = mount(UiErrorState, { props: { error: new Error('x'), retryable: false } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('details').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('UiDialog: начальный фокус', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const body = () => new DOMWrapper(document.body)

  it('по умолчанию фокус получает первый доступный элемент, а с initialFocus — запрошенный', async () => {
    const open = async (initialFocus?: string) => {
      const wrapper = mount(UiDialog, {
        props: { open: true, title: 'Окно', ...(initialFocus ? { initialFocus } : {}) },
        slots: { default: '<input name="field" aria-label="Поле" />' },
        attachTo: document.body,
      })
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 30))
      const focused = document.activeElement
      wrapper.unmount()
      document.body.innerHTML = ''
      return focused
    }
    const byDefault = await open()
    expect(byDefault?.getAttribute('aria-label')).toBe('Закрыть')
    const requested = await open('input[name="field"]')
    expect(requested?.getAttribute('name')).toBe('field')
    // Селектор без совпадения не ломает окно: остаётся обычный порядок фокуса.
    const missing = await open('input[name="nothing"]')
    expect(missing?.getAttribute('aria-label')).toBe('Закрыть')
    expect(body().find('[role="dialog"]').exists()).toBe(false)
  })
})
