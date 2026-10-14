import { describe, expect, it } from 'vitest'
import { PERMISSIONS, permissionsForRole, roleLabel } from '@/entities/session'

describe('права ролей', () => {
  it('владелец имеет все 16 прав, менеджер — 7 рабочих', () => {
    expect(PERMISSIONS).toHaveLength(16)
    expect(permissionsForRole('OWNER').size).toBe(16)
    const manager = permissionsForRole('MANAGER')
    expect([...manager].sort()).toEqual(
      [
        'action.manage',
        'conversation.read',
        'opportunity.manage',
        'outcome.manage',
        'revenue.confirm',
        'risks.manage',
        'risks.read',
      ].sort(),
    )
    expect(manager.has('service.manage')).toBe(false)
    expect(manager.has('member.manage')).toBe(false)
    // Выгрузка всех данных организации (ADR 0059) — только у владельца.
    expect(permissionsForRole('OWNER').has('organization.export')).toBe(true)
    expect(manager.has('organization.export')).toBe(false)
  })

  it('без роли прав нет', () => {
    expect(permissionsForRole(null).size).toBe(0)
    expect(permissionsForRole(undefined).size).toBe(0)
  })

  it('подписи ролей на русском', () => {
    expect(roleLabel('OWNER')).toBe('Владелец')
    expect(roleLabel('MANAGER')).toBe('Менеджер')
  })
})
