import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VisualCompareError, compareGeometry, comparePair, expandWindows } from './compare-lib.mjs'

const require = createRequire(import.meta.url)
const { PNG } = require('playwright-core/lib/utilsBundle') as {
  PNG: new (options: { width: number; height: number }) => {
    data: Buffer
  } & Record<string, unknown>
} & { sync: { write: (image: unknown) => Buffer } }

let root: string

function png(width: number, height: number, color: [number, number, number] = [255, 255, 255]) {
  const image = new PNG({ width, height })
  for (let i = 0; i < width * height * 4; i += 4) {
    image.data[i] = color[0]
    image.data[i + 1] = color[1]
    image.data[i + 2] = color[2]
    image.data[i + 3] = 255
  }
  return (PNG as unknown as { sync: { write: (image: unknown) => Buffer } }).sync.write(image)
}

function put(kind: 'actual' | 'reference', name: string, buffer: Buffer) {
  mkdirSync(join(root, 'S', kind), { recursive: true })
  writeFileSync(join(root, 'S', kind, `${name}.png`), buffer)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'visual-compare-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const spec = { stage: 'S', name: 'frame' }
const run = (extra = {}) => comparePair({ ...spec, ...extra }, root, { write: false })

describe('защиты сравнения кадров', () => {
  it('равные кадры дают 0 %', () => {
    put('actual', 'frame', png(10, 20))
    put('reference', 'frame', png(10, 20))
    expect(run().percent).toBe(0)
  })

  it('различие каналов выше порога считается расхождением', () => {
    put('actual', 'frame', png(10, 10, [255, 255, 255]))
    put('reference', 'frame', png(10, 10, [0, 0, 0]))
    expect(run().percent).toBe(100)
  })

  it('нет кадра или эталона — ошибка, а не тихий пропуск', () => {
    put('reference', 'frame', png(10, 10))
    expect(() => run()).toThrow(VisualCompareError)
    rmSync(join(root, 'S'), { recursive: true })
    put('actual', 'frame', png(10, 10))
    expect(() => run()).toThrow(/эталон/)
  })

  it('разная ширина — ошибка', () => {
    put('actual', 'frame', png(10, 10))
    put('reference', 'frame', png(12, 10))
    expect(() => run()).toThrow(/ширина/)
  })

  it('разница полных высот без объявления — ошибка; с allowHeightDelta — отражена в отчёте', () => {
    put('actual', 'frame', png(10, 20))
    put('reference', 'frame', png(10, 15))
    expect(() => run()).toThrow(/высоты различаются/)
    expect(() => run({ allowHeightDelta: 4 })).toThrow(/высоты различаются/)
    expect(run({ allowHeightDelta: 5 }).fullDelta).toBe(5)
  })

  it('пустой и выходящий за границы фрагмент — ошибка', () => {
    put('actual', 'frame', png(10, 20))
    put('reference', 'frame', png(10, 20))
    expect(() => run({ region: { y0: 5, y1: 5 } })).toThrow(/пуст/)
    expect(() => run({ region: { y0: 0, y1: 21 } })).toThrow(/вне изображения/)
    expect(() => run({ region: { y0: 0.5, y1: 3 } })).toThrow(/целыми/)
  })

  it('намеренный фрагмент допускает разные полные высоты, но высоты фрагментов обязаны совпасть', () => {
    put('actual', 'frame', png(10, 30))
    put('reference', 'frame', png(10, 10))
    expect(run({ region: { y0: 0, y1: 10 } }).percent).toBe(0)
    expect(() => run({ actual: { y0: 0, y1: 20 }, reference_region: { y0: 0, y1: 10 } })).toThrow(
      /высота фрагмента/,
    )
  })

  it('окна покрывают общую высоту, а хвост длиннее сообщается явно', () => {
    put('actual', 'frame', png(10, 25))
    put('reference', 'frame', png(10, 20))
    const { specs, uncovered } = expandWindows({ ...spec, windows: 10 }, root)
    expect(specs.map((item) => item.region)).toEqual([
      { y0: 0, y1: 10 },
      { y0: 10, y1: 20 },
    ])
    expect(uncovered).toEqual({ delta: 5, side: 'кадр', pixels: 5 })
  })
})

describe('геометрия блоков', () => {
  const geometry = { name: 'detail', blocks: [{ name: 'Ситуация', y: 100, height: 50 }] }

  it('отмечает отклонения за допуск и не падает на допустимых', () => {
    const [near] = compareGeometry(geometry, { Ситуация: { y: 103, height: 52 } })
    expect(near.differs).toBe(false)
    const [far] = compareGeometry(geometry, { Ситуация: { y: 120, height: 50 } })
    expect(far.differs).toBe(true)
    expect(far.dy).toBe(20)
  })

  it('отсутствие блока на странице — ошибка', () => {
    expect(() => compareGeometry(geometry, {})).toThrow(VisualCompareError)
  })
})
