import { z } from 'zod'
export const riskSchema = z.object({
  id: z.string().min(1),
  customer: z.string().min(1),
  amount: z.number().nonnegative(),
  status: z.enum(['open', 'acknowledged', 'closed']),
})
export type Risk = z.infer<typeof riskSchema>
export function acknowledgeRisk(risk: Risk): Risk {
  if (risk.status !== 'open') return risk
  return { ...risk, status: 'acknowledged' }
}
