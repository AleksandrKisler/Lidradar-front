import { afterEach, expect, it, vi } from 'vitest'
const config = vi.hoisted(() => ({ VITE_DEMO_MODE: true }))
vi.mock('@/shared/config', () => ({ env: config }))
vi.mock('@/shared/api', () => ({ getJson: vi.fn() }))
import { getJson } from '@/shared/api'
import { getRisk } from '@/entities/risk'
afterEach(() => {
  config.VITE_DEMO_MODE = true
  vi.resetAllMocks()
})
it('demo does not call the network', async () => {
  expect(await getRisk()).toMatchObject({ id: 'LR-1042', status: 'open' })
  expect(getJson).not.toHaveBeenCalled()
})
it('validates real server data', async () => {
  config.VITE_DEMO_MODE = false
  const value = { id: '2', customer: 'Клиент', amount: 50, status: 'closed' }
  vi.mocked(getJson).mockResolvedValue(value)
  expect(await getRisk()).toEqual(value)
  expect(getJson).toHaveBeenCalledWith('/risks/current')
})
it('rejects malformed server data', async () => {
  config.VITE_DEMO_MODE = false
  vi.mocked(getJson).mockResolvedValue({ id: '2', status: 'wrong' })
  await expect(getRisk()).rejects.toThrow()
})
it('propagates a server failure', async () => {
  config.VITE_DEMO_MODE = false
  vi.mocked(getJson).mockRejectedValue(new Error('offline'))
  await expect(getRisk()).rejects.toThrow('offline')
})
