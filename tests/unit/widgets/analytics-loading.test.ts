import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { UiCard, UiSkeleton } from '@/shared/ui'
import AnalyticsLoading from '@/widgets/analytics/ui/AnalyticsLoading.vue'

type LoadingVariant =
  'overview' | 'risk-events' | 'risk-precision' | 'payment-totals' | 'payment-journal'
const typeNames = [
  'Нет ответа клиенту',
  'Клиент молчит после цены',
  'Запись не подтверждена',
  'Обещание не выполнено',
  'Стоит напомнить о себе',
  'Договорённость требует внимания',
]

function render(variant: LoadingVariant, extra = {}) {
  return mount(AnalyticsLoading, { props: { variant, ...extra } })
}

describe('утверждённая композиция загрузки аналитики', () => {
  it('Обзор сохраняет график, атрибуцию, риски и все нижние блоки со статическими подписями', () => {
    const wrapper = render('overview')
    expect(wrapper.findAll('h3').map((node) => node.text())).toEqual([
      'Возвращённая выручка',
      'Подтверждённые оплаты',
      'Сообщения',
      'Сделки',
      'Записанные исходы',
      'Оценки сделок',
    ])
    expect(wrapper.findAll('.overview-risks .metric-label').map((node) => node.text())).toEqual([
      'Найдено рисков',
      'С действием',
      'Закрыто рисков',
    ])
    expect(wrapper.findAll('.attribution dt').map((node) => node.text())).toEqual([
      'После работы с риском',
      'Без связи с риском',
      'Связь не определена',
    ])
    expect(wrapper.findAll('.activity-group')).toHaveLength(3)
    expect(wrapper.findAll('.activity-group dt').map((node) => node.text())).toEqual([
      'Всего',
      'Входящие',
      'Исходящие',
      'Новые переписки',
      'Создано',
      'Переход в запись',
      'Выиграно',
      'Потеряно',
      'Запись',
      'Оплачено',
      'Потеря',
    ])
    expect(wrapper.findAll('.estimates-grid dt').map((node) => node.text())).toEqual([
      'Открытые сделки, созданные в периоде',
      'Сделки с активным риском',
      'Известная оценка сделок с риском',
    ])
    expect(wrapper.text()).toContain('Исход «Оплачено» сам по себе не подтверждает выручку.')
    expect(wrapper.text()).toContain('Это независимые показатели.')
    expect(wrapper.text()).toContain('Сделка с несколькими рисками учитывается один раз.')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').text()).toBe('Данные по дням')
    expect(wrapper.findAllComponents(UiSkeleton).length).toBeGreaterThan(20)
    wrapper.unmount()
  })

  it('сводка событий сохраняет 4 KPI и 6 типов в утверждённом порядке без внешней карточки и заголовка', () => {
    const wrapper = render('risk-events')
    expect(wrapper.findAllComponents(UiCard)).toHaveLength(0)
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.findAll('.quality-metric .metric-label').map((node) => node.text())).toEqual([
      'Найдено',
      'С действием',
      'Закрыто',
      'Ложных',
    ])
    expect(wrapper.findAll('.quality-type h3').map((node) => node.text())).toEqual(typeNames)
    for (const card of wrapper.findAll('.quality-type')) {
      expect(card.findAll('dt').map((node) => node.text())).toEqual([
        'Найдено',
        'С действием',
        'Закрыто',
        'Ложных',
      ])
      expect(card.findAllComponents(UiSkeleton)).toHaveLength(4)
    }
    expect(wrapper.text()).not.toContain('Точность')
    wrapper.unmount()
  })

  it('качество загружается независимо: сохраняет подписи покрытия и точности без неопределённых процентов', () => {
    const wrapper = render('risk-precision')
    expect(wrapper.findAllComponents(UiCard)).toHaveLength(0)
    expect(wrapper.find('h2').exists()).toBe(false)
    expect(wrapper.text()).toContain('Загружаем оценки за выбранный период…')
    expect(wrapper.findAll('.quality-metric .metric-label').map((node) => node.text())).toEqual([
      'Рисков',
      'Оценено',
      'Покрытие',
      'Точность',
    ])
    expect(wrapper.findAll('.quality-type h3').map((node) => node.text())).toEqual(typeNames)
    for (const card of wrapper.findAll('.quality-type')) {
      expect(card.findAll('dt').map((node) => node.text())).toEqual([
        'Рисков',
        'Оценено',
        'Покрытие',
        'Точность',
        'Ложные',
      ])
      expect(card.findAll('dd')).toHaveLength(5)
      expect(card.findAll('.precision-basis [aria-hidden="true"]')).toHaveLength(2)
    }
    expect(wrapper.text()).toContain('Низкое покрытие не является ошибкой.')
    expect(wrapper.text()).not.toContain('%')
    wrapper.unmount()
  })

  it('итоги оплат состоят из двух подписанных карточек без журнала и вымышленных сумм', () => {
    const wrapper = render('payment-totals', { currency: 'KZT' })
    expect(wrapper.findAllComponents(UiCard)).toHaveLength(2)
    expect(wrapper.findAll('.metric-label').map((node) => node.text())).toEqual([
      'Подтверждено · KZT',
      'Из них возвращено',
    ])
    expect(wrapper.findAllComponents(UiSkeleton)).toHaveLength(4)
    expect(wrapper.find('h3').exists()).toBe(false)
    expect(wrapper.find('.payment-journal').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/\d|₽|₸/)
    wrapper.unmount()
  })

  it('журнал содержит только 4 строки skeleton внутри слота, без повторного внешнего блока или действий', () => {
    const wrapper = render('payment-journal', { currency: 'RUB', timeZone: 'Europe/Moscow' })
    expect(wrapper.findAllComponents(UiCard)).toHaveLength(0)
    expect(wrapper.findAll('h2, h3')).toHaveLength(0)
    expect(wrapper.findAll('.payment-row')).toHaveLength(4)
    for (const row of wrapper.findAll('.payment-row'))
      expect(row.findAllComponents(UiSkeleton)).toHaveLength(6)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('button, a, time').exists()).toBe(false)
    wrapper.unmount()
  })

  it('валюта отображается только из достоверных props, без fallback на демонстрационный RUB', () => {
    for (const variant of ['overview', 'payment-totals'] as const) {
      const unknown = render(variant)
      expect(unknown.text()).not.toContain('RUB')
      expect(unknown.text()).not.toContain('Москва')
      unknown.unmount()
      const known = render(variant, { currency: 'JPY' })
      expect(known.text()).toContain(' · JPY')
      expect(known.text()).not.toContain('RUB')
      known.unmount()
    }
  })

  it.each<LoadingVariant>([
    'overview',
    'risk-events',
    'risk-precision',
    'payment-totals',
    'payment-journal',
  ])('%s не подменяет загрузку нулями и оставляет объявление статуса родителю', (variant) => {
    const wrapper = render(variant)
    expect(wrapper.text()).not.toMatch(/\d|%|₽/)
    expect(wrapper.find('[role="status"], [aria-live], [role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[style*="opacity: 0"], .opacity-0').exists()).toBe(false)
    expect(wrapper.findAllComponents(UiSkeleton).length).toBeGreaterThan(0)
    for (const skeleton of wrapper.findAllComponents(UiSkeleton)) {
      expect(skeleton.attributes('aria-hidden')).toBe('true')
      expect(skeleton.text()).toBe('')
    }
    wrapper.unmount()
  })
})
