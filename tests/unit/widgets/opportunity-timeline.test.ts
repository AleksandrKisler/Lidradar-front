import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { OpportunityStageHistory } from '@/entities/risk'
import OpportunityTimeline from '@/widgets/risk-workspace/ui/OpportunityTimeline.vue'

const entries: OpportunityStageHistory[] = [
  {
    id: 'h-1',
    opportunityId: 'o',
    fromStage: null,
    toStage: 'NEW',
    source: 'RULE',
    confidence: null,
    aiRunId: null,
    actorUserId: null,
    createdAt: '2026-09-18T09:00:00Z',
  },
  {
    id: 'h-2',
    opportunityId: 'o',
    fromStage: 'NEW',
    toStage: 'PRICE_SENT',
    source: 'AI',
    confidence: 0.87,
    aiRunId: 'run',
    actorUserId: null,
    createdAt: '2026-09-18T10:00:00Z',
  },
  {
    id: 'h-3',
    opportunityId: 'o',
    fromStage: 'PRICE_SENT',
    toStage: 'LOST',
    source: 'USER',
    confidence: null,
    aiRunId: null,
    actorUserId: 'u',
    createdAt: '2026-09-19T10:00:00Z',
  },
]

describe('OpportunityTimeline', () => {
  it('показывает переходы от новых к старым с источником и уверенностью', () => {
    const wrapper = mount(OpportunityTimeline, { props: { entries, timeZone: 'Europe/Moscow' } })
    const rows = wrapper.findAll('li').map((row) => row.text())
    expect(rows[0]).toContain('Цена отправлена → Потеряна')
    expect(rows[0]).toContain('Вручную')
    expect(rows[1]).toContain('Новая → Цена отправлена')
    expect(rows[1]).toContain('уверенность 87 %')
    expect(rows[2]).toContain('Создана как «Новая»')
    expect(rows[2]).toContain('Правило')
    expect(rows[2]).not.toContain('уверенность')
    wrapper.unmount()
  })

  it('пустая история подписана честно', () => {
    const wrapper = mount(OpportunityTimeline, { props: { entries: [], timeZone: 'UTC' } })
    expect(wrapper.text()).toContain('История этапов пока пуста')
    wrapper.unmount()
  })
})
