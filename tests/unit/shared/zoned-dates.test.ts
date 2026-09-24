import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  formatCalendarDate,
  isCalendarDate,
  zonedDayStart,
} from '@/shared/lib'

describe('календарные даты', () => {
  it('проверяет существование даты, а не только формат', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('26-01-01')).toBe(false)
    expect(isCalendarDate('')).toBe(false)
  })

  it('считает дни и сдвигает даты без часовых поясов', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(30)
    expect(daysBetween('2026-09-24', '2026-09-24')).toBe(1)
    expect(daysBetween('2026-09-25', '2026-09-24')).toBe(0)
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(366)
    expect(daysBetween('2025-01-01', '2026-01-02')).toBe(367)
  })

  it('начало дня в поясе без перехода на летнее время', () => {
    expect(zonedDayStart('2026-09-24', 'Europe/Moscow').toISOString()).toBe(
      '2026-09-23T21:00:00.000Z',
    )
    expect(zonedDayStart('2026-09-24', 'UTC').toISOString()).toBe('2026-09-24T00:00:00.000Z')
    expect(zonedDayStart('2026-09-24', 'Asia/Kolkata').toISOString()).toBe(
      '2026-09-23T18:30:00.000Z',
    )
  })

  it('учитывает переходы на летнее время: смещение берётся для самого момента', () => {
    // 8 марта 2026 в Нью-Йорке часы переводят в 02:00; полночь ещё зимняя (UTC-5).
    expect(zonedDayStart('2026-03-08', 'America/New_York').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    )
    expect(zonedDayStart('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    )
    // 1 ноября 2026 переводят назад; полночь ещё летняя (UTC-4), следующая — зимняя.
    expect(zonedDayStart('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    )
    expect(zonedDayStart('2026-11-02', 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    )
  })

  it('неизвестный пояс считается UTC', () => {
    expect(zonedDayStart('2026-09-24', 'Mars/Olympus').toISOString()).toBe(
      '2026-09-24T00:00:00.000Z',
    )
  })

  it('подписывает календарную дату без сдвига по поясу', () => {
    expect(formatCalendarDate('2026-08-15')).toBe('15 августа 2026 г.')
    expect(formatCalendarDate('2026-08-15', { month: 'short', year: false })).toBe('15 авг.')
  })
})
