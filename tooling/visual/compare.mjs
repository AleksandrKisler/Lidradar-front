/**
 * Сравнение кадров реализации с экспортами Figma.
 * Использование: `node tooling/visual/compare.mjs [pairs.json]`.
 * Результаты — в `artifacts/frontend-v2/<stage>/diff/` (`.a.png` кадр, `.r.png`
 * эталон, `.d.png` красным расхождение канала > 24/255) и в `diff-summary.txt`.
 * Доля расхождения — ориентир, а не критерий приёмки. Ненулевой код выхода:
 * любая ошибка входов (нет кадра или эталона, разная ширина, неверный фрагмент,
 * непредусмотренная разница высот) и отсутствие блока геометрии.
 * Различия геометрии (`geometry`) выводятся и сохраняются, но сами по себе кода не меняют.
 */
import fs from 'node:fs'
import path from 'node:path'
import { VisualCompareError, comparePair, compareGeometry, expandWindows } from './compare-lib.mjs'

const root = path.resolve('artifacts/frontend-v2')
const pairsFile = process.argv[2] ?? new URL('./pairs.json', import.meta.url).pathname
const { pairs, geometry = [] } = JSON.parse(fs.readFileSync(pairsFile, 'utf8'))

const lines = []
const log = (line) => {
  console.log(line)
  lines.push(line)
}
let failures = 0

const expanded = []
for (const pair of pairs) {
  try {
    const { specs, uncovered } = expandWindows(pair, root)
    expanded.push(...specs)
    if (uncovered) {
      log(
        `${pair.stage}/${pair.name}: полные высоты различаются на ${uncovered.pixels} px ` +
          `(длиннее ${uncovered.side}); этот хвост не сравнивался`,
      )
    }
  } catch (error) {
    if (!(error instanceof VisualCompareError)) throw error
    failures++
    log(`ОШИБКА ${error.message}`)
  }
}

for (const spec of expanded) {
  try {
    const r = comparePair(spec, root)
    const region = `${r.actual.region.y0}-${r.actual.region.y1}`
    const heights =
      r.fullDelta === 0
        ? `высота ${r.actual.height}`
        : `высоты: кадр ${r.actual.height}, эталон ${r.reference.height} (Δ${r.fullDelta})`
    log(
      `${r.id} [${region}] ${heights}: расхождение ${r.percent.toFixed(2)} %` +
        (r.note ? ` — ${r.note}` : ''),
    )
  } catch (error) {
    if (!(error instanceof VisualCompareError)) throw error
    failures++
    log(`ОШИБКА ${error.message}`)
  }
}

for (const spec of geometry) {
  const measuredFile = `${root}/${spec.stage}/actual/${spec.name}.geometry.json`
  if (!fs.existsSync(measuredFile)) {
    failures++
    log(`ОШИБКА ${spec.stage}/${spec.name}: нет замеров геометрии ${measuredFile}`)
    continue
  }
  try {
    const rows = compareGeometry(spec, JSON.parse(fs.readFileSync(measuredFile, 'utf8')))
    log(`${spec.stage}/${spec.name} геометрия (допуск ±${spec.tolerance ?? 4} px):`)
    for (const row of rows) {
      log(
        `  ${row.differs ? 'ОТЛИЧАЕТСЯ' : 'совпало   '} ${row.name}: y ${row.actual.y} (эталон ${row.expected.y}, Δ${row.dy}), ` +
          `высота ${row.actual.height} (эталон ${row.expected.height}, Δ${row.dh})`,
      )
    }
  } catch (error) {
    if (!(error instanceof VisualCompareError)) throw error
    failures++
    log(`ОШИБКА ${error.message}`)
  }
}

fs.writeFileSync(`${root}/diff-summary.txt`, lines.join('\n') + '\n')
if (failures > 0) {
  console.error(`\nОшибок входов или области сравнения: ${failures}`)
  process.exit(1)
}
