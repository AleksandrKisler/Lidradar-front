import { describe, expect, it } from 'vitest'
import { DELETION_GRACE_DAYS, blockerLines, formatDueDate } from '@/features/auth-session'

/** Тексты закрытия аккаунта (ADR 0059): срок в UTC и формулировки причин блокировки. */

describe('formatDueDate', () => {
  it('называет дату и время в UTC одним и тем же образом', () => {
    expect(formatDueDate('2026-11-13T09:00:00Z')).toBe('13 ноября 2026, 09:00 (UTC)')
    expect(formatDueDate('2026-01-05T00:05:00Z')).toBe('5 января 2026, 00:05 (UTC)')
    // Время считается в UTC независимо от часового пояса записи.
    expect(formatDueDate('2026-11-13T12:00:00+03:00')).toBe('13 ноября 2026, 09:00 (UTC)')
  })

  it('для нечитаемой даты возвращает тире, а не «Invalid Date»', () => {
    for (const value of [null, undefined, '', 'вчера', '2026-13-45']) {
      expect(formatDueDate(value as string | null | undefined), String(value)).toBe('—')
    }
  })

  it('льготный срок совпадает с политикой ADR 0056', () => {
    expect(DELETION_GRACE_DAYS).toBe(30)
  })
})

describe('blockerLines', () => {
  it('единственный владелец при других участниках — передать владение', () => {
    const [line] = blockerLines([
      { code: 'SOLE_OWNER', organizationName: 'Салон Лотос', hasOtherMembers: true },
    ])
    expect(line!.text).toBe(
      'Вы единственный владелец организации «Салон Лотос». Передайте владение другому участнику в «Настройки → Команда».',
    )
  })

  it('единственный участник — организацию закрывает поддержка', () => {
    const [line] = blockerLines([
      { code: 'SOLE_OWNER', organizationName: 'Одиночка', hasOtherMembers: false },
    ])
    expect(line!.text).toContain('единственный участник организации «Одиночка»')
    expect(line!.text).toContain('поддержка LidRadar')
  })

  it('отсутствие признака участников трактуется осторожно: как «можно передать владение»', () => {
    const [line] = blockerLines([{ code: 'SOLE_OWNER', organizationName: 'Без признака' }])
    expect(line!.text).toContain('Передайте владение')
  })

  it('без названия организации не выдумывает его', () => {
    const [line] = blockerLines([{ code: 'SOLE_OWNER' }])
    expect(line!.text).toContain('организации.')
    expect(line!.text).not.toContain('организации «')
  })

  it('администратор платформы — отозвать право может только оператор', () => {
    const [line] = blockerLines([{ code: 'PLATFORM_ADMIN' }])
    expect(line!.text).toContain('администратора платформы')
    expect(line!.text).toContain('оператор')
  })

  it('ключи строк уникальны даже для одинаковых причин', () => {
    const lines = blockerLines([
      { code: 'SOLE_OWNER', organizationName: 'A', hasOtherMembers: true },
      { code: 'SOLE_OWNER', organizationName: 'A', hasOtherMembers: true },
    ])
    expect(new Set(lines.map((line) => line.key)).size).toBe(2)
    expect(blockerLines([])).toEqual([])
  })
})
