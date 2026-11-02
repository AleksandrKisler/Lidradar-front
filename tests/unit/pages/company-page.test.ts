import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/app/router/routes'
import { ApiError } from '@/shared/api'
import { fetchMe, useSessionStore } from '@/entities/session'
import { timeZoneOptions } from '@/entities/organization'
import { CompanyPage } from '@/pages/onboarding'

vi.mock('@/entities/session/api/auth-api', () => ({
  fetchMe: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}))

const user = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: 'Мария Владелец',
  status: 'ACTIVE' as const,
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
  emailVerifiedAt: null,
  deletionDueAt: null,
}
const company = {
  id: 't-1',
  name: 'Detail Lab',
  defaultTimezone: 'Europe/Moscow',
  defaultCurrency: 'RUB',
  status: 'ACTIVE',
  createdAt: '2026-10-13T00:00:00Z',
  updatedAt: '2026-10-13T00:00:00Z',
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}

/** Шаг 1 «Компания» (US-M02-01): состояния формы по макетам «Ошибка», «Сохранение и проверка», «Первичная загрузка». */
describe('страница «Компания» (шаг 1)', () => {
  let fetchMock: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>

  beforeEach(async () => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(fetchMe).mockReset()
    vi.mocked(fetchMe).mockResolvedValue({ user, memberships: [], canCreateOrganization: true })
    await useSessionStore().bootstrap()
    fetchMock = vi.fn<(request: Request) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  async function mountPage(props: { loading?: boolean } = {}, path = '/onboarding/company') {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    await router.isReady()
    const wrapper = mount(CompanyPage, {
      props,
      attachTo: document.body,
      global: {
        plugins: [
          router,
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
    })
    return { wrapper, router }
  }

  async function existingOwner(canCreateOrganization = false) {
    vi.mocked(fetchMe).mockResolvedValue({
      user,
      memberships: [{ tenantId: company.id, organizationName: company.name, role: 'OWNER' }],
      canCreateOrganization,
    })
    await useSessionStore().refresh()
    fetchMock.mockImplementation(
      async (request) =>
        new Response(
          JSON.stringify(
            request.method === 'PATCH'
              ? { ...company, ...(await request.clone().json()) }
              : company,
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
  }

  it.each([false, true])(
    'возврат к компании при canCreate=%s: заполненная форма и PATCH того же tenant, без POST',
    async (allowed) => {
      await existingOwner(allowed)
      const { wrapper, router } = await mountPage()
      await settle()
      expect(wrapper.get('input[name="organization"]').element).toHaveProperty(
        'value',
        company.name,
      )
      expect(wrapper.get('button[type="submit"]').text()).toBe('Сохранить и продолжить')
      await wrapper.get('input[name="organization"]').setValue('Новая вывеска')
      await wrapper.get('form').trigger('submit')
      await settle()
      const writes = fetchMock.mock.calls
        .map(([request]) => request)
        .filter((request) => request.method !== 'GET')
      expect(writes).toHaveLength(1)
      expect(writes[0]!.method).toBe('PATCH')
      expect(writes[0]!.headers.get('X-Tenant-ID')).toBe(company.id)
      expect(await writes[0]!.json()).toEqual({ name: 'Новая вывеска' })
      expect(router.currentRoute.value.name).toBe('onboarding-location')
      expect(useSessionStore().tenantId).toBe(company.id)
      wrapper.unmount()
    },
  )

  it('возврат без изменений: продолжает мастер без POST и PATCH', async () => {
    await existingOwner()
    const { wrapper, router } = await mountPage()
    await settle()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock.mock.calls.every(([request]) => request.method === 'GET')).toBe(true)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('ошибка PATCH оставляет название в форме и на шаге 1; повтор обновляет ту же компанию', async () => {
    await existingOwner()
    const { wrapper, router } = await mountPage()
    await settle()
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'INTERNAL', message: 'x', traceId: 'edit-1' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await wrapper.get('input[name="organization"]').setValue('Исправленное имя')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('input[name="organization"]').element).toHaveProperty(
      'value',
      'Исправленное имя',
    )
    expect(wrapper.text()).toContain('edit-1')
    expect(router.currentRoute.value.name).toBe('onboarding-company')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock.mock.calls.filter(([request]) => request.method === 'PATCH')).toHaveLength(2)
    expect(fetchMock.mock.calls.some(([request]) => request.method === 'POST')).toBe(false)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('ошибка загрузки существующей компании не подменяется пустой формой создания', async () => {
    await existingOwner(true)
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }),
    )
    const { wrapper } = await mountPage()
    await settle()
    expect(wrapper.text()).toContain('Не удалось загрузить компанию')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('input[name="organization"]').exists()).toBe(false)
    expect(fetchMock.mock.calls.every(([request]) => request.method === 'GET')).toBe(true)
    wrapper.unmount()
  })

  it('явное новое пространство сохраняет отдельный путь создания с пустой формой', async () => {
    await existingOwner(true)
    const { wrapper } = await mountPage({}, '/onboarding/company?new=1')
    expect(wrapper.get('input[name="organization"]').element).toHaveProperty('value', '')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Создать компанию')
    expect(fetchMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('recovery query чужой компании не разрешает GET/PATCH/POST без подтверждённого членства', async () => {
    await existingOwner(true)
    const { wrapper } = await mountPage({}, '/onboarding/company?company=other-tenant')
    await settle()
    expect(wrapper.text()).toContain('Не удалось загрузить компанию')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useSessionStore().tenantId).toBe(company.id)
    wrapper.unmount()
  })

  it('показывает три строки формы, подсказки и кнопку «Создать компанию»', async () => {
    const { wrapper } = await mountPage()
    expect(wrapper.get('h1').text()).toBe('Расскажите о компании')
    expect(wrapper.text()).toContain('Время в отчётах и событиях.')
    expect(wrapper.text()).toContain('Для расчёта потенциала сделок и выручки.')
    expect(wrapper.text()).toContain('Далее: Точка и график')
    expect(wrapper.get('button[type="submit"]').text()).toBe('Создать компанию')
    expect(wrapper.text()).toContain('Вы управляете действиями.')
    wrapper.unmount()
  })

  it('пустое название: «Введите название компании.», запрос не уходит, фокус на поле', async () => {
    const { wrapper } = await mountPage()
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Введите название компании.')
    const input = wrapper.get('input[name="organization"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })

  it.each([
    [201, 'Слишком длинное название'],
    [200, ''],
  ])('название из %i символов', async (length, message) => {
    const { wrapper } = await mountPage()
    fetchMock.mockReturnValue(new Promise(() => {}))
    await wrapper.get('input[name="organization"]').setValue('я'.repeat(length))
    await wrapper.get('form').trigger('submit')
    await settle()
    if (message) {
      expect(wrapper.text()).toContain(message)
      expect(fetchMock).not.toHaveBeenCalled()
    } else {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
    wrapper.unmount()
  })

  it('отправка: поля заблокированы, «Создаём компанию…» сохраняет имя кнопки, двойной щелчок даёт один запрос', async () => {
    const { wrapper } = await mountPage()
    fetchMock.mockReturnValue(new Promise(() => {}))
    await wrapper.get('input[name="organization"]').setValue('Detail Lab')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const button = wrapper.get('button[type="submit"]')
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.get('span[aria-hidden="true"]').text()).toBe('Создаём компанию…')
    expect(button.get('.sr-only').text()).toBe('Создать компанию')
    expect(wrapper.get('input[name="organization"]').attributes('disabled')).toBeDefined()
    for (const select of wrapper.findAll('select')) {
      expect(select.attributes('disabled')).toBeDefined()
    }
    wrapper.unmount()
  })

  it('успех: тело запроса с обрезанным названием, пояс IANA и валюта; сессия перечитана, переход на шаг 2', async () => {
    const { wrapper, router } = await mountPage()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 't-1',
          name: 'Detail Lab',
          defaultTimezone: 'Europe/Moscow',
          defaultCurrency: 'RUB',
          status: 'ACTIVE',
          createdAt: '2026-10-13T00:00:00Z',
          updatedAt: '2026-10-13T00:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.mocked(fetchMe).mockResolvedValueOnce({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Detail Lab', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await wrapper.get('input[name="organization"]').setValue('  Detail Lab  ')
    await wrapper.findAll('select')[0]!.setValue('Europe/Moscow')
    await wrapper.findAll('select')[1]!.setValue('RUB')
    await wrapper.get('form').trigger('submit')
    await settle()
    const sent = (await fetchMock.mock.calls[0]![0].json()) as Record<string, string>
    expect(sent).toEqual({
      name: 'Detail Lab',
      defaultTimezone: 'Europe/Moscow',
      defaultCurrency: 'RUB',
    })
    expect(useSessionStore().tenantId).toBe('t-1')
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('организация создана, а перечитать сессию не удалось: повтор не создаёт вторую организацию', async () => {
    const { wrapper, router } = await mountPage()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 't-1',
          name: 'Detail Lab',
          defaultTimezone: 'Europe/Moscow',
          defaultCurrency: 'RUB',
          status: 'ACTIVE',
          createdAt: '2026-10-13T00:00:00Z',
          updatedAt: '2026-10-13T00:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.mocked(fetchMe).mockRejectedValueOnce(
      new ApiError({ httpStatus: 503, code: 'UNAVAILABLE', message: 'down', traceId: 't-9' }),
    )
    await wrapper.get('input[name="organization"]').setValue('Detail Lab')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('t-9')
    expect(router.currentRoute.value.name).not.toBe('onboarding-location')
    vi.mocked(fetchMe).mockResolvedValueOnce({
      user,
      memberships: [{ tenantId: 't-1', organizationName: 'Detail Lab', role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    // Запрос на создание ушёл один раз; повтор только перечитал членства.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('после 201 и сбоя сессии повтор сохраняет исправленное название PATCH без второго POST', async () => {
    const { wrapper, router } = await mountPage({}, '/onboarding/company?new=1')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(company), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.mocked(fetchMe).mockRejectedValueOnce(
      new ApiError({ httpStatus: 503, code: 'UNAVAILABLE', traceId: 'recovery-1' }),
    )
    await wrapper.get('input[name="organization"]').setValue(company.name)
    await wrapper.findAll('select')[0]!.setValue(company.defaultTimezone)
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(router.currentRoute.value.query).toEqual({ company: company.id })
    await wrapper.get('input[name="organization"]').setValue('Исправленное имя')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...company, name: 'Исправленное имя' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.mocked(fetchMe).mockResolvedValueOnce({
      user,
      memberships: [{ tenantId: company.id, organizationName: company.name, role: 'OWNER' }],
      canCreateOrganization: false,
    })
    await wrapper.get('form').trigger('submit')
    await settle()
    const writes = fetchMock.mock.calls
      .map(([request]) => request)
      .filter((request) => request.method !== 'GET')
    expect(writes.map((request) => request.method)).toEqual(['POST', 'PATCH'])
    expect(writes[1]!.headers.get('X-Tenant-ID')).toBe(company.id)
    expect(await writes[1]!.json()).toEqual({ name: 'Исправленное имя' })
    expect(router.currentRoute.value.name).toBe('onboarding-location')
    wrapper.unmount()
  })

  it('сбой сервера: плашка с идентификатором запроса, поля снова доступны, фокус на поле', async () => {
    const { wrapper } = await mountPage()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'x', traceId: 't-31' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await wrapper.get('input[name="organization"]').setValue('Detail Lab')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('[role="alert"]').text()).toContain('t-31')
    const input = wrapper.get('input[name="organization"]')
    expect(input.attributes('disabled')).toBeUndefined()
    expect(document.activeElement).toBe(input.element)
    wrapper.unmount()
  })

  it('первичная загрузка: каркас без полей, без кнопок и действия отправки', async () => {
    const { wrapper } = await mountPage({ loading: true })
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('Загрузка')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Создать компанию')
    wrapper.unmount()
  })
})

describe('подписи часовых поясов', () => {
  it('российские пояса подписаны по-русски со смещением, остальные идентификатором; значением остаётся идентификатор IANA', () => {
    const options = timeZoneOptions()
    const moscow = options.find((option) => option.value === 'Europe/Moscow')
    expect(moscow?.label).toMatch(/^Москва · UTC\+3$/)
    const berlin = options.find((option) => option.value === 'Europe/Berlin')
    expect(berlin?.label).toBe('Europe/Berlin')
    // Значение — всегда идентификатор IANA: подпись на него не влияет.
    expect(moscow?.value).toBe('Europe/Moscow')
  })
})
