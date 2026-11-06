import { describe, expect, it } from 'vitest'
import { accountInitials } from '@/widgets/app-shell/model/account'
import { isSectionCurrent } from '@/widgets/app-shell/model/navigation'

describe('accountInitials', () => {
  it('берёт первые буквы двух первых слов настоящего имени', () => {
    expect(accountInitials('Мария Владелец')).toBe('МВ')
    expect(accountInitials('  анна   мария  петрова ')).toBe('АМ')
    expect(accountInitials('Ёлка')).toBe('Ё')
  })

  it('без имени возвращает пустую строку, а не выдуманные буквы', () => {
    expect(accountInitials('')).toBe('')
    expect(accountInitials('   ')).toBe('')
    expect(accountInitials(null)).toBe('')
    expect(accountInitials(undefined)).toBe('')
  })

  it('не разрывает символы вне базовой плоскости', () => {
    expect(accountInitials('𝒜лиса Смит')).toBe('𝒜С')
  })
})

describe('isSectionCurrent', () => {
  it('карточка риска оставляет выбранным Radar, вкладки настроек — «Настройки»', () => {
    expect(isSectionCurrent('/radar', false, 'risk')).toBe(true)
    expect(isSectionCurrent('/conversations', false, 'risk')).toBe(false)
    expect(isSectionCurrent('/settings', false, 'settings-team')).toBe(true)
    expect(isSectionCurrent('/radar', true, 'radar')).toBe(true)
    expect(isSectionCurrent('/analytics', false, undefined)).toBe(false)
  })

  it('деталь диалога сохраняет активный модуль, настройки не выбирают соседний раздел', () => {
    expect(isSectionCurrent('/conversations', false, 'conversation')).toBe(true)
    expect(isSectionCurrent('/radar', false, 'conversation')).toBe(false)
    expect(isSectionCurrent('/settings', false, 'settings')).toBe(true)
    for (const name of [
      'settings-company',
      'settings-services',
      'settings-notifications',
      'settings-team',
      'settings-privacy',
      'settings-account',
    ]) {
      expect(isSectionCurrent('/settings', false, name)).toBe(true)
      expect(isSectionCurrent('/analytics', false, name)).toBe(false)
      expect(isSectionCurrent('/conversations', false, name)).toBe(false)
    }
  })
})
