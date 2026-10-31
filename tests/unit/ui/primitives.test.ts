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
  UiSheetDialog,
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

/** Имя элемента в фокусе и нажатие Tab с модификаторами из него — для тестов обхода окна. */
const focusedName = () => {
  const element = document.activeElement as HTMLElement
  return element.getAttribute('aria-label') ?? element.getAttribute('name') ?? element.textContent
}
const pressTab = (init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...init,
  })
  document.activeElement!.dispatchEvent(event)
  return event
}
const settleDialog = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 30))
}

describe('UiDialog: фокус не покидает окно (Codex-R2, пункт 2)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('Tab и Option+Tab обходят доступные элементы по кругу, пропуская скрытые и недоступные', async () => {
    const wrapper = mount(UiDialog, {
      props: { open: true, title: 'Окно' },
      slots: {
        default:
          '<input name="first" aria-label="Первое" /><input name="off" aria-label="Недоступное" disabled />' +
          '<button type="button" hidden>Скрытая</button><div inert><input aria-label="Инертное" /></div>' +
          '<a href="#help">Справка</a>',
        footer: '<button type="button">Отмена</button><button type="button">Сохранить</button>',
      },
      attachTo: document.body,
    })
    await settleDialog()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(focusedName()).toBe('Закрыть')
    const forward: (string | null)[] = []
    for (let index = 0; index < 5; index += 1) {
      expect(pressTab().defaultPrevented).toBe(true)
      forward.push(focusedName())
    }
    expect(forward).toEqual(['Первое', 'Справка', 'Отмена', 'Сохранить', 'Закрыть'])
    pressTab({ shiftKey: true })
    expect(focusedName()).toBe('Сохранить')
    pressTab({ altKey: true })
    expect(focusedName()).toBe('Закрыть')
    pressTab({ altKey: true, shiftKey: true })
    expect(focusedName()).toBe('Сохранить')
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(pressTab({ ctrlKey: true }).defaultPrevented).toBe(false)
    expect(pressTab({ metaKey: true }).defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('окно без кнопки «Закрыть» (идёт отправка) держит фокус на своих элементах', async () => {
    const wrapper = mount(UiDialog, {
      props: { open: true, title: 'Окно', dismissible: false },
      slots: { default: '<input name="only" aria-label="Единственное" />' },
      attachTo: document.body,
    })
    await settleDialog()
    expect(focusedName()).toBe('Единственное')
    pressTab()
    expect(focusedName()).toBe('Единственное')
    pressTab({ shiftKey: true, altKey: true })
    expect(focusedName()).toBe('Единственное')
    wrapper.unmount()
  })

  it('вложенное окно ведёт обход само, родительское его не перехватывает', async () => {
    // Функциональный компонент: второй defineComponent в файле нарушил бы vue/one-component-per-file.
    const nested = () =>
      h(
        UiDialog,
        { open: true, title: 'Родитель' },
        {
          default: () => [
            h('input', { name: 'parent', 'aria-label': 'Поле родителя' }),
            h(
              UiDialog,
              { open: true, title: 'Дочернее' },
              {
                default: () => h('input', { name: 'child', 'aria-label': 'Поле дочернего' }),
              },
            ),
          ],
        },
      )
    const wrapper = mount(nested, { attachTo: document.body })
    await settleDialog()
    const child = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((element) =>
      element.textContent?.includes('Дочернее'),
    )!
    child.querySelector<HTMLElement>('input')!.focus()
    const visited: (string | null)[] = []
    for (let index = 0; index < 3; index += 1) {
      pressTab()
      visited.push(focusedName())
    }
    expect(visited).toEqual(['Закрыть', 'Поле дочернего', 'Закрыть'])
    expect(child.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('Escape и клик снаружи закрывают окно, а при отправке (dismissible: false) — нет', async () => {
    const escape = async (dismissible: boolean) => {
      const wrapper = mount(UiDialog, {
        props: { open: true, title: 'Окно', dismissible },
        slots: { default: '<input name="field" aria-label="Поле" />' },
        attachTo: document.body,
      })
      await settleDialog()
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
      await flushPromises()
      const emitted = wrapper.emitted('update:open') ?? []
      wrapper.unmount()
      document.body.innerHTML = ''
      return emitted
    }
    expect(await escape(true)).toEqual([[false]])
    expect(await escape(false)).toEqual([])
  })
})

describe('UiSheetDialog: фокус не покидает окно (F-04)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /** Tab, Option+Tab и Shift-варианты: окно само ведёт обход, не полагаясь на порядок браузера. */
  it('Tab и Option+Tab обходят поля и кнопки по кругу, Shift — в обратную сторону', async () => {
    const wrapper = mount(UiSheetDialog, {
      props: { open: true, title: 'Окно' },
      slots: {
        default:
          '<input name="first" aria-label="Первое" /><input name="off" aria-label="Скрытое" disabled /><select name="second" aria-label="Второе"><option>1</option></select>',
        footer: '<button type="button">Отмена</button><button type="button">Сохранить</button>',
      },
      attachTo: document.body,
    })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 30))
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const name = () => {
      const element = document.activeElement as HTMLElement
      return (
        element.getAttribute('aria-label') ?? element.getAttribute('name') ?? element.textContent
      )
    }
    const press = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        ...init,
      })
      document.activeElement!.dispatchEvent(event)
      return event
    }
    expect(name()).toBe('Закрыть')
    const forward: (string | null)[] = []
    for (let index = 0; index < 5; index += 1) {
      expect(press({}).defaultPrevented).toBe(true)
      forward.push(name())
    }
    expect(forward).toEqual(['Первое', 'Второе', 'Отмена', 'Сохранить', 'Закрыть'])
    // Option+Tab (WebKit: обход кнопок) с последней кнопки тоже возвращается в начало окна.
    press({ shiftKey: true })
    expect(name()).toBe('Сохранить')
    press({ altKey: true })
    expect(name()).toBe('Закрыть')
    press({ altKey: true, shiftKey: true })
    expect(name()).toBe('Сохранить')
    expect(dialog.contains(document.activeElement)).toBe(true)
    // Ctrl/Cmd+Tab — команды браузера, окно их не перехватывает.
    expect(press({ ctrlKey: true }).defaultPrevented).toBe(false)
    expect(press({ metaKey: true }).defaultPrevented).toBe(false)
    wrapper.unmount()
  })
})

describe('UiDialog: боковое меню оболочки Radar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('прижато к левому краю, заголовок скрыт для глаз, шапка из слота, Tab не выходит из меню', async () => {
    const wrapper = mount(UiDialog, {
      props: { open: true, title: 'Меню', size: 'drawer' },
      slots: {
        header: '<p>LidRadar</p>',
        default: '<a href="#radar">Radar</a><a href="#dialogs">Диалоги</a>',
      },
      attachTo: document.body,
    })
    await settleDialog()
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.className).toContain('left-0')
    expect(dialog.className).toContain('w-[344px]')
    expect(dialog.className).toContain('max-w-full')
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!)!
    expect(title.textContent).toBe('Меню')
    expect(title.className).toContain('sr-only')
    expect(dialog.textContent).toContain('LidRadar')
    expect(focusedName()).toBe('Закрыть')
    const order: (string | null)[] = []
    for (let index = 0; index < 3; index += 1) {
      pressTab()
      order.push(focusedName())
    }
    expect(order).toEqual(['Radar', 'Диалоги', 'Закрыть'])
    document.querySelector<HTMLElement>('[aria-label="Закрыть"]')!.click()
    await settleDialog()
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })
})
