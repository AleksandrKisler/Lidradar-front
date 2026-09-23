import { describe, expect, it } from 'vitest'
import { PERMISSIONS, permissionsForRole, roleLabel } from '@/entities/session'

describe('права ролей', () => {
  it('владелец имеет все 15 прав, менеджер — 7 рабочих', () => {
    expect(PERMISSIONS).toHaveLength(15)
    expect(permissionsForRole('OWNER').size).toBe(15)
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
