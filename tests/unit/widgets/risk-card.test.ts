import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { toRiskCard } from '@/entities/risk'
import RiskCard from '@/widgets/risk-feed/ui/RiskCard.vue'
import { riskDetailFixture } from '../fixtures/risk-detail'

describe('карточка риска в ленте', () => {
  it('показывает неизвестные услугу и сумму рядом с известным каналом', () => {
    const card = toRiskCard({
      ...riskDetailFixture,
      risk: {
        ...riskDetailFixture.risk,
        type: 'UNFINISHED_AGREEMENT',
        reason: 'Точка пока не подтвердила перенос записи',
      },
      opportunity: { ...riskDetailFixture.opportunity!, serviceId: null, potentialRevenue: null },
      service: null,
    })
    const wrapper = mount(RiskCard, {
      props: { card, timeZone: 'Europe/Moscow', now: new Date('2026-09-18T10:00:00Z') },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    expect(wrapper.text()).toContain('Договорённость требует внимания')
    expect(wrapper.text()).toContain('Услуга не уточнена · Telegram')
    expect(wrapper.text()).toContain('Неизвестна')
    expect(wrapper.text()).toContain('Сумма сделки')
    expect(wrapper.text()).toContain('Точка пока не подтвердила перенос записи')
    wrapper.unmount()
  })
})

describe('карточка риска: представления v2', () => {
  const props = {
    card: toRiskCard(riskDetailFixture),
    timeZone: 'Europe/Moscow',
    now: new Date('2026-09-18T10:00:00Z'),
  }
  const global = {
    stubs: {
      RouterLink: {
        props: ['to'],
        template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
      },
    },
  }

  it('статусы группы «В работе» (ACKNOWLEDGED и ACTED) выделяются акцентом, прочие — нет', () => {
    const accent = (status: 'OPEN' | 'ACKNOWLEDGED' | 'ACTED') => {
      const wrapper = mount(RiskCard, {
        props: {
          ...props,
          card: toRiskCard({ ...riskDetailFixture, risk: { ...riskDetailFixture.risk, status } }),
        },
        global,
      })
      const label = wrapper.findAll('span').find((node) => node.classes().includes('font-medium'))
      const result = wrapper.html().includes('text-brand')
      wrapper.unmount()
      void label
      return result
    }
    expect(accent('ACKNOWLEDGED')).toBe(true)
    expect(accent('ACTED')).toBe(true)
    expect(accent('OPEN')).toBe(false)
  })

  it('плитка и строка списка ведут в один и тот же риск и называют его в ссылке разбора', () => {
    for (const view of ['tiles', 'list'] as const) {
      const wrapper = mount(RiskCard, { props: { ...props, view }, global })
      const cta = wrapper.findAll('a').find((link) => link.attributes('aria-label'))!
      expect(cta.attributes('aria-label')).toContain(props.card.contactName)
      expect(JSON.parse(cta.attributes('data-to')!)).toEqual({
        name: 'risk',
        params: { riskId: props.card.id },
      })
      expect(wrapper.text()).toContain(props.card.typeLabel)
      wrapper.unmount()
    }
  })

  it('время ожидания и обнаружения остаются доступны скринридеру, внешняя ссылка не выводится', () => {
    const wrapper = mount(RiskCard, {
      props: { ...props, card: { ...props.card, externalUrl: 'tg://user?id=1' } },
      global,
    })
    const spokenDates = wrapper.get('dl.sr-only').text()
    expect(spokenDates).toContain('Срок по правилу')
    expect(spokenDates).toContain('Риск обнаружен')
    expect(spokenDates).not.toContain('Ожидание с')
    // Однозначная дата с годом, временем и поясом организации.
    expect(spokenDates).toMatch(/\d{4} · \d{2}:\d{2}/)
    expect(wrapper.get('dl.sr-only time').attributes('datetime')).toBe(props.card.dueAt)
    expect(wrapper.html()).not.toContain('tg://user')
    wrapper.unmount()
  })
})

describe('строка списка не содержит лишнего текста', () => {
  it('колонка действия состоит из суммы, подписи и ссылки разбора', () => {
    const wrapper = mount(RiskCard, {
      props: {
        card: toRiskCard(riskDetailFixture),
        timeZone: 'UTC',
        now: new Date('2026-09-18T10:00:00Z'),
        view: 'list',
      },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    })
    const action = wrapper.findAll('a').find((link) => link.attributes('aria-label'))!
    expect(action.element.parentElement!.textContent).not.toMatch(/>\s*$/)
    expect(action.element.nextSibling).toBeNull()
    wrapper.unmount()
  })
})

describe('подпись карточки: услуга и точка', () => {
  const base = {
    card: toRiskCard(riskDetailFixture),
    timeZone: 'UTC',
    now: new Date('2026-09-18T10:00:00Z'),
  }
  const global = { stubs: { RouterLink: { template: '<a><slot /></a>' } } }
  const locationNames = { [riskDetailFixture.risk.locationId!]: 'Тверская' }

  it('плитка показывает «услуга · точка», список добавляет канал', () => {
    const tile = mount(RiskCard, { props: { ...base, view: 'tiles', locationNames }, global })
    expect(tile.text()).toContain('Полировка · Тверская')
    expect(tile.text()).not.toContain('Полировка · Тверская · Telegram')
    const list = mount(RiskCard, { props: { ...base, view: 'list', locationNames }, global })
    expect(list.text()).toContain('Полировка · Тверская · Telegram')
    tile.unmount()
    list.unmount()
  })

  it('без имени точки остаётся канал, как раньше', () => {
    const wrapper = mount(RiskCard, { props: { ...base }, global })
    expect(wrapper.text()).toContain('Полировка · Telegram')
    wrapper.unmount()
  })
})
