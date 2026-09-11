import { getJson } from '@/shared/api'
import { env } from '@/shared/config'
import { riskSchema, type Risk } from '../model/risk'
export async function getRisk(): Promise<Risk> {
  if (env.VITE_DEMO_MODE)
    return { id: 'LR-1042', customer: 'Дмитрий Соколов', amount: 31000, status: 'open' }
  return riskSchema.parse(await getJson('/risks/current'))
}
