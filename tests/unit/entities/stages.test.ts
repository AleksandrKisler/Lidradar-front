import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_STAGE_ORDER,
  allowedNextStages,
  changeOpportunityStage,
  describeClosingStage,
  fetchOpportunityDetail,
  isActiveStage,
  isClosingStage,
  opportunityKeys,
  stageSourceLabel,
} from '@/entities/risk'

describe('матрица этапов сделки', () => {
  it('активный этап предлагает только следующие активные и «Потеряна»', () => {
    for (const [index, stage] of ACTIVE_STAGE_ORDER.entries()) {
      if (stage === 'BOOKED') continue
      const allowed = allowedNextStages(stage)
      expect(allowed).toEqual([...ACTIVE_STAGE_ORDER.slice(index + 1), 'LOST'])
      expect(allowed).not.toContain(stage)
      expect(allowed).not.toContain('WON')
      expect(allowed).not.toContain('ARCHIVED')
      for (const earlier of ACTIVE_STAGE_ORDER.slice(0, index))
        expect(allowed).not.toContain(earlier)
    }
  })

  it('из записи — выигрыш или потеря; закрытые — только архив; архив — тупик', () => {
    expect(allowedNextStages('BOOKED')).toEqual(['WON', 'LOST'])
    expect(allowedNextStages('WON')).toEqual(['ARCHIVED'])
    expect(allowedNextStages('LOST')).toEqual(['ARCHIVED'])
    expect(allowedNextStages('ARCHIVED')).toEqual([])
    expect(allowedNextStages('UNKNOWN')).toEqual([])
    expect(isActiveStage('NEW')).toBe(true)
    expect(isActiveStage('WON')).toBe(false)
    expect(isClosingStage('LOST')).toBe(true)
    expect(isClosingStage('ENGAGED')).toBe(false)
  })

  it('подписывает источник перехода и последствия закрытия', () => {
    expect(stageSourceLabel('USER')).toBe('Вручную')
    expect(stageSourceLabel('AI')).toBe('AI')
    expect(stageSourceLabel('X')).toBe('X')
    expect(describeClosingStage('WON')).toContain('Оплата подтверждается отдельно')
    expect(describeClosingStage('LOST')).toContain('вернуть её в работу нельзя')
    expect(describeClosingStage('ARCHIVED')).toContain('архив')
    expect(describeClosingStage('NEW')).toBe('')
  })
})

describe('запросы сделки', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>
  beforeEach(() => {
    fetchMock = vi.fn<(request: Request) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ opportunity: { stage: 'ENGAGED' }, stageHistory: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ключ под префиксом opportunity, чтение и PATCH с телом этапа', async () => {
    expect(opportunityKeys.detail('t-1', 'o-1')).toEqual(['tenant', 't-1', 'opportunity', 'o-1'])
    await fetchOpportunityDetail('t-1', 'o-1')
    const read = fetchMock.mock.calls[0]![0]
    expect(new URL(read.url).pathname).toBe('/api/v1/opportunities/o-1')
    expect(read.headers.get('X-Tenant-ID')).toBe('t-1')
    await changeOpportunityStage('t-1', 'o-1', 'ENGAGED')
    const patch = fetchMock.mock.calls[1]![0]
    expect(patch.method).toBe('PATCH')
    expect(await patch.json()).toEqual({ stage: 'ENGAGED' })
  })
})
