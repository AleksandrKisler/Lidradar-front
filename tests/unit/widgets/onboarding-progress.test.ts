import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { OnboardingStatus } from '@/entities/organization'
import { OnboardingProgress } from '@/widgets/onboarding-progress'

function status(done: Record<string, boolean>): OnboardingStatus {
  const step = (key: string, required: boolean) => ({ key, required, done: done[key] ?? false })
  return {
    complete: false,
    nextStep: 'CHANNEL',
    steps: [
      step('ORGANIZATION', true),
      step('LOCATION', true),
      step('SERVICES', true),
      step('CHANNEL', true),
      step('TELEGRAM_LINK', false),
    ],
    facts: {} as OnboardingStatus['facts'],
    computedAt: '2026-10-08T10:00:00Z',
  } as OnboardingStatus
}

/** Кружок шага: цифра или значок. */
const circles = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('li').map((item) => {
    const circle = item.get('span[aria-hidden="true"]')
    return { text: circle.text(), icon: circle.find('svg').exists() }
  })

describe('шаги начала работы', () => {
  it('четыре обязательных шага: выполненные — галочка, текущий — цифра; привязка уведомлений в ряд не входит', () => {
    const wrapper = mount(OnboardingProgress, {
      props: {
        status: status({ ORGANIZATION: true, LOCATION: true, SERVICES: true }),
        current: 'CHANNEL',
      },
    })
    expect(circles(wrapper)).toEqual([
      { text: '', icon: true },
      { text: '', icon: true },
      { text: '', icon: true },
      { text: '4', icon: false },
    ])
    expect(wrapper.text()).not.toContain('Уведомления в Telegram')
    // Текущий шаг помечен на элементе списка; название и состояние читаются и при скрытой подписи.
    expect(wrapper.get('li[aria-current="step"]').get('.sr-only').text().replace(/\s+/g, ' ')).toBe(
      'Источник сообщений текущий шаг',
    )
    // Подпись «Шаг n из 4» и название на телефоне дублируют текущий шаг.
    expect(wrapper.get('p').text().replace(/\s+/g, ' ')).toBe('Шаг 4 из 4 · Источник сообщений')
    wrapper.unmount()
  })

  it('до загрузки статуса пройденными считаются шаги до текущего (мастер идёт по порядку), текущий берётся из маршрута', () => {
    const wrapper = mount(OnboardingProgress, { props: { status: null, current: 'LOCATION' } })
    expect(circles(wrapper).map((circle) => circle.text)).toEqual(['', '2', '3', '4'])
    expect(circles(wrapper)[0]!.icon).toBe(true)
    expect(wrapper.get('p').text()).toContain('Шаг 2 из 4')
    wrapper.unmount()
  })

  it('шаг «Источник» получает галочку, только когда подключены источник и личные уведомления', () => {
    const connected = { ORGANIZATION: true, LOCATION: true, SERVICES: true, CHANNEL: true }
    const withoutLink = mount(OnboardingProgress, {
      props: { status: status(connected), current: 'CHANNEL' },
    })
    expect(circles(withoutLink)[3]).toEqual({ text: '4', icon: false })
    withoutLink.unmount()
    const withLink = mount(OnboardingProgress, {
      props: { status: status({ ...connected, TELEGRAM_LINK: true }), current: 'CHANNEL' },
    })
    expect(circles(withLink)[3]).toEqual({ text: '', icon: true })
    withLink.unmount()
  })

  it('выполненность и текущий шаг озвучиваются скрытым текстом', () => {
    const wrapper = mount(OnboardingProgress, {
      props: { status: status({ ORGANIZATION: true }), current: 'LOCATION' },
    })
    const items = wrapper.findAll('li')
    const spoken = (index: number) => items[index]!.get('.sr-only').text().replace(/\s+/g, ' ')
    expect(spoken(0)).toBe('Компания выполнено')
    expect(spoken(1)).toBe('Точка и график текущий шаг')
    expect(spoken(2)).toBe('Услуги и цены')
    wrapper.unmount()
  })
})
