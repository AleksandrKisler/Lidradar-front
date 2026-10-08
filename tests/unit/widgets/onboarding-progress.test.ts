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

/** Кружок шага: цифра или значок; видимый текст нужен для проверки нумерации. */
const circles = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('li').map((item) => {
    const circle = item.get('span[aria-hidden="true"]')
    return { text: circle.text(), icon: circle.find('svg').exists() }
  })

describe('шаги начала работы', () => {
  it('нумеруются только обязательные шаги, необязательный помечен значком', () => {
    const wrapper = mount(OnboardingProgress, {
      props: {
        status: status({ ORGANIZATION: true, LOCATION: true, SERVICES: true }),
        current: 'CHANNEL',
      },
    })
    // Три выполненных шага — галочки, четвёртый — цифра 4, пятого номера нет.
    expect(circles(wrapper)).toEqual([
      { text: '', icon: true },
      { text: '', icon: true },
      { text: '', icon: true },
      { text: '4', icon: false },
      { text: '', icon: true },
    ])
    expect(wrapper.text()).not.toContain('5')
    expect(wrapper.text()).toContain('необязательно')
    expect(wrapper.get('[aria-current="step"]').text()).toBe('Источник сообщений')
    wrapper.unmount()
  })

  it('до загрузки статуса необязательным считается привязка уведомлений', () => {
    const wrapper = mount(OnboardingProgress, { props: { status: null, current: 'LOCATION' } })
    expect(circles(wrapper).map((circle) => circle.text)).toEqual(['1', '2', '3', '4', ''])
    expect(circles(wrapper)[4]!.icon).toBe(true)
    wrapper.unmount()
  })
})
