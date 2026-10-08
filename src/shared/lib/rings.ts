/**
 * Геометрия концентрических колец. Чистые функции без DOM: компонент
 * получает готовые фигуры и только рисует их.
 *
 * Кольцо начинается вверху и идёт по часовой стрелке. Дуги рисуются с круглыми
 * торцами; границы сдвигаются на половину толщины, так что видимая длина дуги
 * равна доле значения, а соседние сегменты разделены ровным зазором.
 */

const TAU = Math.PI * 2
const START = -Math.PI / 2
/** Короче этого (в радианах) дуга превращается в точку: иначе путь вырождается. */
const MIN_ARC = 1e-3

export type RingPiece =
  /** Сегмент занимает всё кольцо: рисуется целой окружностью. */
  | { index: number; shape: 'circle' }
  | { index: number; shape: 'path'; d: string }
  /** Слишком малая доля: точка диаметром в толщину кольца. */
  | { index: number; shape: 'dot'; x: number; y: number }

function point(radius: number, angle: number): { x: number; y: number } {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
}

const fixed = (value: number) => Number(value.toFixed(2))

/** Дуга окружности с центром в нуле от угла `from` до `to` по часовой стрелке. */
export function arcPath(radius: number, from: number, to: number): string {
  const a = point(radius, from)
  const b = point(radius, to)
  const large = to - from > Math.PI ? 1 : 0
  return `M ${fixed(a.x)} ${fixed(a.y)} A ${radius} ${radius} 0 ${large} 1 ${fixed(b.x)} ${fixed(b.y)}`
}

/**
 * Раскладывает значения по кольцу, где `max` — полный круг. Отрицательные и
 * нечисловые значения считаются нулём, сумма сверх `max` обрезается. Нулевые
 * сегменты и кольцо без знаменателя не дают фигур: остаётся только фон.
 *
 * @param gap зазор между соседними сегментами в пикселях по линии кольца
 */
export function layoutRing(
  radius: number,
  strokeWidth: number,
  values: readonly number[],
  max: number,
  gap = 3,
): RingPiece[] {
  if (!(max > 0) || !(radius > 0)) return []
  let room = max
  const parts = values.map((raw) => {
    const wanted = Number.isFinite(raw) && raw > 0 ? raw : 0
    const taken = Math.min(wanted, room)
    room -= taken
    return taken
  })
  const filled = parts.filter((part) => part > 0).length
  if (filled === 0) return []

  const whole = parts.findIndex((part) => part >= max - 1e-9)
  if (whole >= 0) return [{ index: whole, shape: 'circle' }]

  const halfGap = filled > 1 ? gap / radius / 2 : 0
  const cap = strokeWidth / 2 / radius
  const pieces: RingPiece[] = []
  let passed = 0
  parts.forEach((part, index) => {
    if (part <= 0) return
    const begin = START + (passed / max) * TAU
    passed += part
    const end = START + (passed / max) * TAU
    const from = begin + halfGap + cap
    const to = end - halfGap - cap
    if (to - from > MIN_ARC) {
      pieces.push({ index, shape: 'path', d: arcPath(radius, from, to) })
    } else {
      const { x, y } = point(radius, (begin + end) / 2)
      pieces.push({ index, shape: 'dot', x: fixed(x), y: fixed(y) })
    }
  })
  return pieces
}
