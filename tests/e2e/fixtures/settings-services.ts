import type { Page } from '@playwright/test'
import type { components } from '../../../src/shared/api/generated/schema'
import { TENANT_ID } from './api'
import { deferred, FIRST_LOCATION, SECOND_LOCATION, settingsFixture } from './settings-company'

type Service = components['schemas']['ServiceCatalogItem']
export type ServiceEndpoint = 'list' | 'create' | 'update' | 'deactivate'
export const SERVICE_IDS = Array.from(
  { length: 6 },
  (_, index) => `01990000-0000-7000-8000-00000000030${index + 1}`,
)
export const CREATED_SERVICE_ID = '01990000-0000-7000-8000-000000000401'
const stamp = '2026-09-01T09:00:00Z'

/** Local, mutable API dataset shared by behavioural tests and visual captures. No navigation. */
export async function settingsServicesFixture(
  page: Page,
  options: {
    empty?: boolean
    longNames?: boolean
    sessionName?: string
    traceId?: string
    role?: 'OWNER' | 'MANAGER'
  } = {},
) {
  const base = await settingsFixture(page, {
    role: options.role,
    longNames: options.longNames,
    sessionName: options.sessionName,
    traceId: options.traceId,
  })
  const examples: Array<[string, string | null, string | null]> = [
    ['Полировка кузова', '31000.00', '31000.00'],
    ['Химчистка', '8000.00', '12000.00'],
    ['Комплексная мойка', '1500.00', null],
    ['Удаление царапин', null, '3500.00'],
    ['Керамическое покрытие', null, null],
    ['Предпродажный осмотр', '1490.50', '1490.50'],
  ]
  const services: Service[] = options.empty
    ? []
    : examples.map(([name, priceFrom, priceTo], index) => ({
        id: SERVICE_IDS[index]!,
        name: options.longNames
          ? `${name} ${'профессиональный уход за автомобилем '.repeat(4)}`
          : name,
        normalizedName: name.toLowerCase(),
        locationId: index === 0 ? FIRST_LOCATION : index === 1 ? SECOND_LOCATION : null,
        priceFrom,
        priceTo,
        currency: 'RUB',
        active: index !== 3,
        createdAt: stamp,
        updatedAt: stamp,
      }))
  const calls: Array<{
    method: string
    path: string
    tenantId: string | undefined
    body: unknown
  }> = []
  const failures = new Map<ServiceEndpoint, number | 'network'>()
  const holds = new Map<ServiceEndpoint, ReturnType<typeof deferred>>()
  let createdCount = 0
  await page.route(/\/api\/v1\/services(?:\/[0-9a-f-]{36})?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const tenantId = request.headers()['x-tenant-id']
    const body: unknown = ['POST', 'PATCH'].includes(method) ? request.postDataJSON() : null
    calls.push({ method, path, tenantId, body })
    if (tenantId !== TENANT_ID)
      return route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN' } } })
    const endpoint: ServiceEndpoint =
      method === 'GET'
        ? 'list'
        : method === 'POST'
          ? 'create'
          : method === 'DELETE'
            ? 'deactivate'
            : 'update'
    const gate = holds.get(endpoint)
    if (gate) await gate.promise
    const failure = failures.get(endpoint)
    if (failure === 'network') return route.abort('failed')
    if (failure)
      return route.fulfill({
        status: failure,
        json: {
          error: {
            code: failure < 500 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
            message: '',
            traceId: options.traceId ?? 'services-fixture',
          },
        },
      })
    if (method === 'GET') return route.fulfill({ json: { items: services } })
    if (method === 'POST') {
      const input = body as components['schemas']['CreateServiceCatalogItemRequest']
      const created: Service = {
        id: `01990000-0000-7000-8000-${String(401 + createdCount++).padStart(12, '0')}`,
        locationId: input.locationId ?? null,
        name: input.name,
        normalizedName: input.name.toLowerCase(),
        priceFrom: input.priceFrom ?? null,
        priceTo: input.priceTo ?? null,
        currency: input.currency,
        active: true,
        createdAt: stamp,
        updatedAt: stamp,
      }
      services.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    const target = services.find((item) => path.endsWith(`/${item.id}`))
    if (!target) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } })
    if (method === 'DELETE') {
      target.active = false
      return route.fulfill({ status: 204 })
    }
    if (method === 'PATCH') {
      Object.assign(target, body)
      return route.fulfill({ json: target })
    }
    return route.fulfill({ status: 405 })
  })
  return {
    ...base,
    services,
    calls,
    failures,
    hold(endpoint: ServiceEndpoint) {
      const gate = deferred()
      holds.set(endpoint, gate)
      return gate
    },
    release(endpoint: ServiceEndpoint) {
      holds.get(endpoint)?.release()
      holds.delete(endpoint)
    },
    writes(method?: string) {
      return calls.filter((call) => call.method !== 'GET' && (!method || call.method === method))
    },
    dispose() {
      holds.forEach((gate) => gate.release())
      holds.clear()
      base.dispose()
    },
  }
}
export type SettingsServicesFixture = Awaited<ReturnType<typeof settingsServicesFixture>>
