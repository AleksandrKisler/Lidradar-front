/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatDistanceStrict } from 'date-fns'
import { ru } from 'date-fns/locale'
import { describe, expect, it } from 'vitest'
import { formatRelative } from '@/shared/lib/date-time'

const NOW = new Date('2026-01-15T12:00:00Z')
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY
const units = { second: SECOND, minute: MINUTE, hour: HOUR, day: DAY, month: MONTH, year: YEAR }
const directions = [-1, 1] as const
const oracle = (date: Date, now = NOW) =>
  formatDistanceStrict(date, now, { addSuffix: true, locale: ru })

const distances = Object.entries(units).flatMap(([unit, duration]) =>
  [0, 1, 2, 5, 11, 12, 21, 22, 25, 101, 111, 1000].flatMap((count) =>
    directions.map((direction) => ({
      unit,
      count,
      direction,
      delta: direction * count * duration,
    })),
  ),
)

// Половины округления и границы выбора единиц, включая переход 12 месяцев → 1 год.
const boundaries = [
  SECOND / 2,
  MINUTE - SECOND / 2,
  MINUTE,
  MINUTE * 1.5,
  HOUR - MINUTE / 2,
  HOUR,
  HOUR * 1.5,
  DAY - HOUR / 2,
  DAY,
  DAY * 1.5,
  MONTH - DAY / 2,
  MONTH,
  MONTH * 1.5,
  MONTH * 11.5,
  YEAR,
  YEAR * 1.5,
].flatMap((boundary) =>
  [-1, 0, 1].flatMap((offset) =>
    directions.map((direction) => ({
      boundary,
      offset,
      direction,
      delta: direction * (boundary + offset),
    })),
  ),
)

describe('formatRelative: совместимость с русской date-fns locale', () => {
  it.each(distances)('$unit × $count, направление $direction', ({ delta }) => {
    const date = new Date(NOW.getTime() + delta)
    expect(formatRelative(date, NOW)).toBe(oracle(date))
    expect(formatRelative(date.toISOString(), NOW)).toBe(oracle(date))
  })

  it.each(boundaries)(
    'граница $boundary мс, смещение $offset, направление $direction',
    ({ delta }) => {
      const date = new Date(NOW.getTime() + delta)
      expect(formatRelative(date, NOW)).toBe(oracle(date))
    },
  )

  it.each([
    [0, '0 секунд назад'],
    [-SECOND, '1 секунду назад'],
    [SECOND, 'через 1 секунду'],
    [-2 * HOUR, '2 часа назад'],
    [15 * MINUTE, 'через 15 минут'],
    [-21 * YEAR, '21 год назад'],
    [22 * YEAR, 'через 22 года'],
    [-1000 * YEAR, '1000 лет назад'],
    [1000 * YEAR, 'через 1000 лет'],
  ])('сохраняет точный UI-текст при смещении %s мс', (delta, expected) => {
    expect(formatRelative(new Date(NOW.getTime() + Number(delta)), NOW)).toBe(expected)
  })

  it.each([null, undefined, '', 'not-a-date'])(
    'сохраняет null для отсутствующей/неверной строки %s',
    (value) => {
      expect(formatRelative(value, NOW)).toBeNull()
    },
  )

  it('сохраняет ошибку Invalid Date', () => {
    expect(() => formatRelative(new Date(Number.NaN), NOW)).toThrow(RangeError)
  })

  it('сохраняет DST-нормализацию date-fns при весеннем и осеннем переходах', () => {
    // Отдельный Node стартует с TZ до инициализации Date: изменение TZ внутри worker ненадёжно.
    const moduleUrl = pathToFileURL(resolve('src/shared/lib/date-time.ts')).href
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import { formatRelative } from ${JSON.stringify(moduleUrl)};
          import { formatDistanceStrict } from 'date-fns';
          import { ru } from 'date-fns/locale';
          const pairs = [
            [new Date(2026, 2, 7, 12), new Date(2026, 2, 8, 12)],
            [new Date(2026, 2, 7, 12), new Date(2026, 2, 9, 12)],
            [new Date(2026, 9, 31, 12), new Date(2026, 10, 1, 12)],
            [new Date(2026, 9, 31, 12), new Date(2026, 10, 2, 12)],
            [new Date(2026, 2, 1, 12), new Date(2026, 2, 31, 12)],
            [new Date(2026, 9, 20, 12), new Date(2026, 10, 19, 12)],
          ];
          console.log(JSON.stringify(pairs.flatMap(([a, b]) => [[a, b], [b, a]])
            .map(([date, now]) => ({
              offsets: [date.getTimezoneOffset(), now.getTimezoneOffset()],
              actual: formatRelative(date, now),
              expected: formatDistanceStrict(date, now, { addSuffix: true, locale: ru }),
            }))));
        `,
      ],
      { encoding: 'utf8', env: { ...process.env, TZ: 'America/New_York' } },
    )
    const rows = JSON.parse(result) as Array<{
      offsets: number[]
      actual: string
      expected: string
    }>
    expect(rows).toHaveLength(12)
    for (const row of rows) {
      expect(row.offsets[0]).not.toBe(row.offsets[1])
      expect(row.actual).toBe(row.expected)
    }
    expect(rows.slice(0, 6).map((row) => row.actual)).toEqual([
      '23 часа назад',
      'через 23 часа',
      '2 дня назад',
      'через 2 дня',
      '1 день назад',
      'через 1 день',
    ])
  })
})
