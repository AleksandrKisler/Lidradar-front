/**
 * Ядро сравнения кадров с эталонами Figma. Любая проблема входов — ошибка
 * (`VisualCompareError`), а не тихий пропуск: отсутствующий кадр или эталон,
 * разная ширина, пустой или выходящий за границы фрагмент, непредусмотренная
 * разница высот. Область сравнения задаётся в `pairs.json` явно и одинаково
 * описывается для кадра (`actual`) и эталона (`reference`).
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

// PNG-кодек поставляется внутри Playwright; отдельная зависимость не добавляется.
const require = createRequire(import.meta.url)
const { PNG } = require('playwright-core/lib/utilsBundle')

export const THRESHOLD = 24

export class VisualCompareError extends Error {}

function readPng(file, label) {
  if (!fs.existsSync(file)) throw new VisualCompareError(`${label}: нет файла ${file}`)
  const image = PNG.sync.read(fs.readFileSync(file))
  if (!image.width || !image.height) throw new VisualCompareError(`${label}: пустое изображение`)
  return image
}

/** Фрагмент `[y0, y1)`: по умолчанию изображение целиком; границы проверяются. */
function regionOf(image, region, label) {
  const y0 = region?.y0 ?? 0
  const y1 = region?.y1 ?? image.height
  if (!Number.isInteger(y0) || !Number.isInteger(y1)) {
    throw new VisualCompareError(`${label}: границы фрагмента должны быть целыми`)
  }
  if (y0 < 0 || y1 > image.height || y1 <= y0) {
    throw new VisualCompareError(
      `${label}: фрагмент ${y0}–${y1} вне изображения высотой ${image.height} или пуст`,
    )
  }
  return { y0, y1 }
}

function crop(image, { y0, y1 }) {
  const out = new PNG({ width: image.width, height: y1 - y0 })
  PNG.bitblt(image, out, 0, y0, image.width, y1 - y0, 0, 0)
  return out
}

/**
 * Сравнивает одну пару. `spec`: `{ stage, name, reference?, actual?, region?,
 * allowHeightDelta?, note? }`. Если фрагменты не заданы, сравниваются кадры
 * целиком и разница полных высот без `allowHeightDelta` — ошибка.
 */
export function comparePair(spec, root, { write = true } = {}) {
  const id = `${spec.stage}/${spec.name}`
  const actualFile = `${root}/${spec.stage}/actual/${spec.name}.png`
  const referenceFile = `${root}/${spec.stage}/reference/${spec.reference ?? spec.name}.png`
  const actual = readPng(actualFile, `${id} (кадр)`)
  const reference = readPng(referenceFile, `${id} (эталон)`)
  if (actual.width !== reference.width) {
    throw new VisualCompareError(
      `${id}: ширина кадра ${actual.width} ≠ ширине эталона ${reference.width}`,
    )
  }
  const fullDelta = actual.height - reference.height
  const wholePage = !spec.region && !spec.actual && !spec.reference_region
  if (wholePage && Math.abs(fullDelta) > (spec.allowHeightDelta ?? 0)) {
    throw new VisualCompareError(
      `${id}: полные высоты различаются (кадр ${actual.height}, эталон ${reference.height}); ` +
        'задайте область сравнения или allowHeightDelta с причиной',
    )
  }
  // Целиком: при объявленной разнице сравнивается общая часть, хвост остаётся в отчёте.
  const common = wholePage ? { y0: 0, y1: Math.min(actual.height, reference.height) } : null
  const aRegion = regionOf(actual, common ?? spec.actual ?? spec.region, `${id} (кадр)`)
  const rRegion = regionOf(
    reference,
    common ?? spec.reference_region ?? spec.region,
    `${id} (эталон)`,
  )
  const heightA = aRegion.y1 - aRegion.y0
  const heightR = rRegion.y1 - rRegion.y0
  if (heightA !== heightR) {
    throw new VisualCompareError(`${id}: высота фрагмента кадра ${heightA} ≠ эталона ${heightR}`)
  }
  const a = crop(actual, aRegion)
  const r = crop(reference, rRegion)
  const d = new PNG({ width: a.width, height: a.height })
  let bad = 0
  for (let i = 0; i < a.width * a.height * 4; i += 4) {
    const delta = Math.max(
      Math.abs(a.data[i] - r.data[i]),
      Math.abs(a.data[i + 1] - r.data[i + 1]),
      Math.abs(a.data[i + 2] - r.data[i + 2]),
    )
    const differs = delta > THRESHOLD
    if (differs) bad++
    d.data[i] = differs ? 255 : a.data[i]
    d.data[i + 1] = differs ? 0 : a.data[i + 1]
    d.data[i + 2] = differs ? 0 : a.data[i + 2]
    d.data[i + 3] = 255
  }
  const percent = (100 * bad) / (a.width * a.height)
  const tag = `${spec.stage}/diff/${spec.name}_${aRegion.y0}-${aRegion.y1}`
  if (write) {
    fs.mkdirSync(`${root}/${spec.stage}/diff`, { recursive: true })
    fs.writeFileSync(`${root}/${tag}.a.png`, PNG.sync.write(a))
    fs.writeFileSync(`${root}/${tag}.r.png`, PNG.sync.write(r))
    fs.writeFileSync(`${root}/${tag}.d.png`, PNG.sync.write(d))
  }
  return {
    id,
    percent,
    width: a.width,
    actual: { height: actual.height, region: aRegion },
    reference: { height: reference.height, region: rRegion },
    fullDelta,
    note: spec.note ?? null,
  }
}

/** Проверка геометрии блоков: `expected` из метаданных Figma, `measured` — из DOM. */
export function compareGeometry(spec, measured) {
  const tolerance = spec.tolerance ?? 4
  const rows = []
  for (const block of spec.blocks) {
    const box = measured[block.name]
    if (!box) {
      throw new VisualCompareError(`${spec.name}: блок «${block.name}» не найден на странице`)
    }
    const dy = Math.round(box.y - block.y)
    const dh = Math.round(box.height - block.height)
    rows.push({
      name: block.name,
      expected: { y: block.y, height: block.height },
      actual: { y: Math.round(box.y), height: Math.round(box.height) },
      dy,
      dh,
      differs: Math.abs(dy) > tolerance || Math.abs(dh) > tolerance,
    })
  }
  return rows
}

/**
 * Разбивает длинный кадр на окна по `windows` px от верха. Сравнивается общая
 * часть высоты; хвост длиннее — явно как `uncovered` (px у кадра или эталона).
 */
export function expandWindows(spec, root) {
  if (!spec.windows) return { specs: [spec], uncovered: null }
  const actual = readPng(
    `${root}/${spec.stage}/actual/${spec.name}.png`,
    `${spec.stage}/${spec.name} (кадр)`,
  )
  const reference = readPng(
    `${root}/${spec.stage}/reference/${spec.reference ?? spec.name}.png`,
    `${spec.stage}/${spec.name} (эталон)`,
  )
  const common = Math.min(actual.height, reference.height)
  const specs = []
  for (let y0 = 0; y0 < common; y0 += spec.windows) {
    specs.push({
      ...spec,
      windows: undefined,
      region: { y0, y1: Math.min(y0 + spec.windows, common) },
    })
  }
  const delta = actual.height - reference.height
  return {
    specs,
    uncovered:
      delta === 0 ? null : { delta, side: delta > 0 ? 'кадр' : 'эталон', pixels: Math.abs(delta) },
  }
}
