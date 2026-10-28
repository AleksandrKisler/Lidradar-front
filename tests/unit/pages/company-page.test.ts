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

  async function mountPage(props: { loading?: boolean } = {}) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/onboarding/company')
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
