import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { Member } from '@/entities/team'
import { MembersTable } from '@/widgets/team'

function member(overrides: Partial<Member>): Member {
  return {
    membershipId: 'm-1',
    userId: 'u-1',
    email: 'owner@example.test',
    displayName: 'Мария Владелец',
    role: 'OWNER',
    status: 'ACTIVE',
    revokedAt: null,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z',
    ...overrides,
  }
}

const owner = member({})
const manager = member({
  membershipId: 'm-2',
  userId: 'u-2',
  role: 'MANAGER',
  displayName: 'Анна Смирнова',
  email: 'manager@example.test',
})
const longEmail =
  'very.long.address.for.narrow.layout.checks@example-organization-with-long-name.test'
const former = member({
  membershipId: 'm-3',
  userId: 'u-3',
  role: 'MANAGER',
  displayName: 'Пётр Бывший-Длиннофамильный',
  email: longEmail,
  status: 'DISABLED',
  revokedAt: '2026-09-10T12:00:00Z',
})

function mountTable(members: Member[] = [former, manager, owner]) {
  return mount(MembersTable, {
    props: { tenantId: 'tenant-a', members, currentUserId: 'u-1', timeZone: 'Europe/Moscow' },
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
      ] as never,
    },
  })
}

describe('таблица участников', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('названа подписью, у столбцов есть заголовки, строки идут владелец → менеджер → отозванный', () => {
    const wrapper = mountTable()
    expect(wrapper.get('caption').text()).toBe('Участники компании')
    expect(wrapper.findAll('thead th').map((cell) => cell.text())).toEqual([
      'Сотрудник',
      'Роль',
      'Доступ',
      'Действия',
    ])
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Мария Владелец')
    expect(rows[1]!.text()).toContain('Анна Смирнова')
    expect(rows[2]!.text()).toContain('Пётр Бывший-Длиннофамильный')
    // Пометка «вы» только у текущего пользователя, инициалы — в аватаре.
    expect(rows[0]!.text()).toContain('· вы')
    expect(rows[1]!.text()).not.toContain('· вы')
    expect(rows[0]!.text()).toContain('МВ')
    wrapper.unmount()
  })

  it('отозванный остаётся в списке с датой и без кнопок, а почта целиком читается и переносится по частям', () => {
    const wrapper = mountTable()
    const row = wrapper.findAll('tbody tr')[2]!
    expect(row.text()).toContain('Доступ отозван')
    expect(row.text()).toMatch(/10 сент\./)
    expect(row.findAll('button')).toHaveLength(0)
    // Подсказки переноса не меняют текст: почту можно выделить и скопировать как есть.
    expect(row.text()).toContain(longEmail)
    expect(row.findAll('wbr').length).toBeGreaterThan(5)
    wrapper.unmount()
  })

  it('табличные роли заданы явно: смена display в узкой раскладке не стирает семантику', () => {
    const wrapper = mountTable()
    expect(wrapper.get('table').attributes('role')).toBe('table')
    for (const group of wrapper.findAll('thead, tbody')) {
      expect(group.attributes('role')).toBe('rowgroup')
    }
    for (const row of wrapper.findAll('tr')) expect(row.attributes('role')).toBe('row')
    for (const cell of wrapper.findAll('th')) expect(cell.attributes('role')).toBe('columnheader')
    for (const cell of wrapper.findAll('td')) expect(cell.attributes('role')).toBe('cell')
    wrapper.unmount()
  })

  it('раскладка выбирается по ширине карточки и не требует горизонтальной прокрутки', () => {
    const wrapper = mountTable()
    // Таблица — только в широкой карточке; в узкой строка — блок из переносимых частей.
    expect(wrapper.get('table').classes()).toEqual(expect.arrayContaining(['block', '@3xl:table']))
    for (const row of wrapper.findAll('tbody tr')) {
      expect(row.classes()).toEqual(expect.arrayContaining(['flex', 'flex-wrap', '@3xl:table-row']))
    }
    // Прокручиваемой области с табуляцией больше нет: ей нечего прокручивать.
    expect(wrapper.find('[tabindex]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('overflow-x-auto')
    expect(wrapper.html()).not.toContain('min-w-[640px]')
    wrapper.unmount()
  })

  it('бейджи и кнопки стоят в одном «первом ряду» высотой с аватар и не растягиваются', () => {
    const wrapper = mountTable()
    const [ownerRow, managerRow] = wrapper.findAll('tbody tr')
    for (const row of [ownerRow!, managerRow!]) {
      const cells = row.findAll('td')
      const roleBox = cells[1]!.get('div')
      const statusBox = cells[2]!.get('div')
      const actionsBox = cells[3]!.get('div > div')
      for (const box of [roleBox, statusBox, actionsBox]) {
        expect(box.classes()).toContain('@3xl:min-h-11')
        expect(box.classes()).toContain('items-center')
        expect(box.classes()).not.toContain('flex-col')
      }
    }
    wrapper.unmount()
  })

  it('кнопки: две в ряд, у единственного владельца отключены, пояснение с иконкой под ними', () => {
    const wrapper = mountTable()
    const [ownerRow, managerRow] = wrapper.findAll('tbody tr')
    const ownerButtons = ownerRow!.findAll('button')
    expect(ownerButtons.map((button) => button.text())).toEqual([
      'Сделать менеджером',
      'Отозвать доступ',
    ])
    expect(ownerButtons.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    const note = ownerRow!.get('p')
    expect(note.text()).toContain('Единственный активный владелец')
    expect(note.get('svg').attributes('aria-hidden')).toBe('true')
    // Пояснение идёт после строки кнопок, а не рядом с ними.
    expect(
      ownerButtons[0]!.element.parentElement!.compareDocumentPosition(note.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const managerButtons = managerRow!.findAll('button')
    expect(managerButtons.map((button) => button.text())).toEqual([
      'Сделать владельцем',
      'Отозвать доступ',
    ])
    expect(managerButtons.every((button) => button.attributes('disabled') === undefined)).toBe(true)
    expect(managerRow!.find('p').exists()).toBe(false)
    wrapper.unmount()
  })
})
