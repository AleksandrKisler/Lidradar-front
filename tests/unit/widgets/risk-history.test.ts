import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RiskHistory, { type RiskTimelineEntry } from '@/widgets/risk-workspace/ui/RiskHistory.vue'

const detected: RiskTimelineEntry = {
  id: 'r',
  kind: 'detected',
  title: 'Риск обнаружен',
  detail: 'Ответа нет больше 60 рабочих минут.',
  createdAt: '2026-10-23T11:22:00Z',
}
const stage: RiskTimelineEntry = {
  id: 's',
  kind: 'stage',
  title: 'Сделка создана · Новая',
  detail: 'Правило',
  createdAt: '2026-10-23T10:22:00Z',
}

describe('история риска', () => {
  it('показывает события от новых к старым с временем организации и числом событий', () => {
    const wrapper = mount(RiskHistory, {
      props: { entries: [stage, detected], timeZone: 'Europe/Moscow' },
    })
    const items = wrapper.findAll('li')
    expect(items[0]!.text()).toContain('14:22')
    expect(items[0]!.text()).toContain('Риск обнаружен')
    expect(items[1]!.text()).toContain('13:22')
    expect(wrapper.text()).toContain('2 события')
    wrapper.unmount()
  })

  it('без действий и исхода говорит об этом, с действием — не говорит', () => {
    const empty = mount(RiskHistory, { props: { entries: [detected], timeZone: 'UTC' } })
    expect(empty.text()).toContain('Действий пока нет.')
    const done = mount(RiskHistory, {
      props: {
        entries: [
          detected,
          {
            id: 'a',
            kind: 'action',
            title: 'Звонок клиенту',
            detail: 'Выполненное действие',
            createdAt: '2026-10-23T12:00:00Z',
          },
        ],
        timeZone: 'UTC',
      },
    })
    expect(done.text()).not.toContain('Действий пока нет.')
    expect(done.text()).toContain('2 события')
    empty.unmount()
    done.unmount()
  })

  it('последний исход — отдельный блок, а не запись списка; полным журналом история не названа', () => {
    const wrapper = mount(RiskHistory, {
      props: {
        entries: [
          detected,
          {
            id: 'o1',
            kind: 'outcome',
            title: 'Думает',
            detail: 'Исход клиента',
            createdAt: '2026-10-23T13:00:00Z',
          },
        ],
        timeZone: 'UTC',
      },
    })
    expect(wrapper.get('[role="group"]').text()).toContain('Последний исход сделки')
    expect(wrapper.get('[role="group"]').text()).toContain('Думает')
    expect(wrapper.get('ol').text()).not.toContain('Думает')
    expect(wrapper.text()).toContain('1 событие')
    expect(wrapper.text()).toContain('Прежние исходы и заметки отсюда не читаются')
    const none = mount(RiskHistory, { props: { entries: [detected], timeZone: 'UTC' } })
    expect(none.get('[role="group"]').text()).toContain('Исход не записан')
    wrapper.unmount()
    none.unmount()
  })

  it('при событиях в разных днях добавляет дату и сортирует по моменту, а не по строке', () => {
    const wrapper = mount(RiskHistory, {
      props: {
        entries: [
          { ...stage, createdAt: '2026-10-22T10:00:00Z' },
          { ...detected, createdAt: '2026-10-23T11:22:00.500Z' },
        ],
        timeZone: 'UTC',
      },
    })
    const items = wrapper.findAll('li')
    expect(items[0]!.text()).toContain('Риск обнаружен')
    expect(items[0]!.get('time').text()).toMatch(/23/)
    expect(items[1]!.get('time').text()).toMatch(/22/)
    wrapper.unmount()
  })
})
