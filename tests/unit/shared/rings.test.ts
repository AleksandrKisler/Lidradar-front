import { describe, expect, it } from 'vitest'
import { arcPath, layoutRing, plural } from '@/shared/lib'

describe('геометрия колец', () => {
  it('кольцо без знаменателя или без значений не даёт фигур', () => {
    expect(layoutRing(50, 10, [3], 0)).toEqual([])
    expect(layoutRing(50, 10, [0, 0], 10)).toEqual([])
    expect(layoutRing(50, 10, [Number.NaN, -2], 10)).toEqual([])
  })

  it('сегмент на весь круг — целая окружность, избыток обрезается', () => {
    expect(layoutRing(50, 10, [10], 10)).toEqual([{ index: 0, shape: 'circle' }])
    expect(layoutRing(50, 10, [0, 25], 10)).toEqual([{ index: 1, shape: 'circle' }])
  })

  it('доля рисуется дугой, вторая половина — дугой по часовой стрелке', () => {
    const [piece] = layoutRing(50, 10, [5], 10)
    expect(piece).toMatchObject({ index: 0, shape: 'path' })
    // Начало вверху (x≈0, y<0), конец внизу (x≈0, y>0) с поправкой на круглые торцы.
    const d = (piece as { d: string }).d
    expect(d.startsWith('M ')).toBe(true)
    expect(d).toContain('A 50 50 0 0 1')
  })

  it('соседние сегменты разделены зазором, а мизерная доля — точка', () => {
    const pieces = layoutRing(50, 10, [4, 6], 10)
    expect(pieces.map((piece) => piece.shape)).toEqual(['path', 'path'])
    const tiny = layoutRing(50, 10, [0.01, 9.99], 10)
    expect(tiny[0]).toMatchObject({ index: 0, shape: 'dot' })
    expect(tiny[1]).toMatchObject({ index: 1, shape: 'path' })
  })

  it('дуга больше полукруга получает флаг большой дуги', () => {
    expect(arcPath(10, -Math.PI / 2, Math.PI)).toContain('A 10 10 0 1 1')
    expect(arcPath(10, -Math.PI / 2, 0)).toContain('A 10 10 0 0 1')
  })
})

describe('склонение по числу', () => {
  it('выбирает форму для 1, 2–4 и 5–20 с исключениями 11–14', () => {
    const forms = [1, 2, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((count) =>
      plural(count, 'оплата', 'оплаты', 'оплат'),
    )
    expect(forms).toEqual([
      'оплата',
      'оплаты',
      'оплат',
      'оплат',
      'оплат',
      'оплат',
      'оплата',
      'оплаты',
      'оплат',
      'оплата',
      'оплат',
    ])
  })
})
