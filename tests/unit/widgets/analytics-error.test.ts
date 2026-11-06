import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ApiError } from '@/shared/api'
import AnalyticsError from '@/widgets/analytics/ui/AnalyticsError.vue'

describe('локальные ошибки аналитики', () => {
  it('повторяет только запрос, заданный владельцем блока, без технических/серверных сообщений', async () => {
    const wrapper = mount(AnalyticsError, {
      props: {
        error: new ApiError({
          httpStatus: 503,
          code: 'UNAVAILABLE',
          message: 'PRIVATE SERVER MESSAGE',
          traceId: 'private-trace',
        }),
        title: 'Не удалось загрузить сводку',
        description: 'Данные за выбранный период сейчас недоступны.',
      },
    })
    expect(wrapper.get('[role=alert]').text()).toContain(
      'Данные за выбранный период сейчас недоступны.',
    )
    expect(wrapper.text()).not.toContain('PRIVATE')
    expect(wrapper.text()).not.toContain('private-trace')
    expect(wrapper.find('details').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
  })
  it.each([403, 404, 429])('сохраняет recovery смысл HTTP%s вместо пустой аналитики', (status) => {
    const error = new ApiError({
      httpStatus: status,
      code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'RATE_LIMITED',
    })
    const wrapper = mount(AnalyticsError, { props: { error, title: 'Не удалось загрузить итоги' } })
    expect(wrapper.text()).not.toContain('Проверьте соединение')
    expect(wrapper.text()).not.toContain('оплат за период нет')
    expect(wrapper.get('button').text()).toBe('Повторить')
  })
  it('встраивается в существующую карточку без второй поверхности', () => {
    const wrapper = mount(AnalyticsError, {
      props: { error: new Error('offline'), title: 'Не удалось загрузить журнал', embedded: true },
    })
    expect(wrapper.find('.analytics-error-card').exists()).toBe(false)
    expect(wrapper.get('[role=alert]').text()).toContain('повторите загрузку этого блока')
  })
})
