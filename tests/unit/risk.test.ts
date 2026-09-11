import { describe, expect, it } from 'vitest'
import { acknowledgeRisk, riskSchema, type Risk } from '@/entities/risk'
const risk: Risk = { id: '1', customer: 'Клиент', amount: 100, status: 'open' }
describe('risk domain', () => {
  it('acknowledges without mutating input', () => {
    expect(acknowledgeRisk(risk).status).toBe('acknowledged')
    expect(risk.status).toBe('open')
  })
  it.each(['closed', 'acknowledged'] as const)('preserves %s status', (status) => {
    const value = { ...risk, status }
    expect(acknowledgeRisk(value)).toBe(value)
  })
  it('rejects invalid server data', () => {
    expect(riskSchema.safeParse({ ...risk, amount: -1 }).success).toBe(false)
  })
})
