import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api'
import { NAV_ITEMS, visibleNavItems } from '@/widgets/app-shell'
import {
  closedByText,
  draftTimeline,
  elapsedLabel,
  sandboxErrorText,
  sentTimeline,
  stageProgress,
  stepStates,
} from '@/widgets/sandbox-workspace/model/view'
import { sandboxConversation, verdict } from '../fixtures/sandbox'

describe('лента песочницы', () => {
  const now = new Date('2026-10-25T12:00:00Z')

  it('черновик показывает паузы подписями и номера для удаления', () => {
    const items = draftTimeline(
      [
        { direction: 'INCOMING', text: 'a', pauseBeforeMinutes: 0 },
        { direction: 'OUTGOING', text: 'b', pauseBeforeMinutes: 10 },
        { direction: 'INCOMING', text: 'c', pauseBeforeMinutes: 0 },
      ],
      60,
      now,
    )
    expect(items.map((item) => (item.kind === 'gap' ? item.label : item.text))).toEqual([
      'a',
      'прошло 10 мин',
      'b',
      'c',
    ])
    const last = items.at(-1)!
    expect(
      last.kind === 'message' &&
        last.draftIndex === 2 &&
        last.at.toISOString() === '2026-10-25T11:00:00.000Z',
    ).toBe(true)
  })

  it('отправленная переписка считает промежутки по времени сообщений и до сейчас', () => {
    const items = sentTimeline(sandboxConversation(), now)
    expect(items.map((item) => (item.kind === 'gap' ? item.label : item.text))).toEqual([
      'Сколько стоит окрашивание?',
      'прошло 10 мин',
      '8 000 ₽, когда удобно?',
      'прошло 1 сутки',
    ])
    expect(sentTimeline(sandboxConversation({ messages: [] }), now)).toEqual([])
    expect([5, 90, 1440, 4000].map(elapsedLabel)).toEqual(['5 мин', '1 ч', '1 сутки', '2 суток'])
  })
})

describe('проверка', () => {
  it('шаги и этапы следуют сверке', () => {
    expect(stepStates(null)).toEqual(['now', 'todo', 'todo'])
    expect(stepStates(verdict())).toEqual(['done', 'now', 'todo'])
    expect(stepStates(verdict({ state: 'MATCH', stage: null }))).toEqual(['done', 'done', 'now'])
    const progress = stageProgress(verdict({ stage: 'ANALYZING' }))
    expect(progress.percent).toBe(50)
    expect(progress.items.map((item) => item.state)).toEqual(['done', 'done', 'now', 'todo'])
    expect(stageProgress(verdict({ stage: null })).percent).toBe(0)
  })

  it('ошибки песочницы и сторона закрытия названы по-человечески', () => {
    expect(
      sandboxErrorText(new ApiError({ httpStatus: 409, code: 'SANDBOX_BUSY' })).title,
    ).toContain('обрабатывается')
    expect(
      sandboxErrorText(new ApiError({ httpStatus: 429, code: 'SANDBOX_AI_BUSY' })).description,
    ).toContain('минуту')
    expect(
      sandboxErrorText(new ApiError({ httpStatus: 400, code: 'INVALID_ARGUMENT' })).title,
    ).toBe('Данные не приняты')
    expect(closedByText('INCOMING')).toContain('клиент')
    expect(closedByText('OUTGOING')).toContain('бизнес')
    expect(closedByText(null)).toContain('не задан')
  })

  it('пункт меню песочницы виден только с признаком из /auth/me', () => {
    const all = () => true
    expect(visibleNavItems(all).some((item) => item.to === '/sandbox')).toBe(false)
    expect(visibleNavItems(all, { sandbox: true }).some((item) => item.to === '/sandbox')).toBe(
      true,
    )
    expect(
      visibleNavItems(() => false, { sandbox: true }).some((item) => item.to === '/sandbox'),
    ).toBe(false)
    expect(NAV_ITEMS.find((item) => item.to === '/sandbox')?.permission).toBe('conversation.read')
  })
})
