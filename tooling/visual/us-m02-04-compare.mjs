/**
 * Сверка кадров US-M02-04 с эталонами Figma (`onboarding.step2`, 12 × 3).
 *
 *   US_M02_04_REVISION=R1 node tooling/visual/us-m02-04-compare.mjs
 *
 * Эталоны — `artifacts/frontend-v2/us-m02-04/reference/` (хеши в `reference.sha256`),
 * кадры — `<revision>/actual/`. Сравнивается окно viewport (desktop 1000, tablet 1194,
 * phone 844): полные высоты страниц не равны высоте frame. Доля расхождения — ориентир
 * для ручной сверки, а не вердикт; 03/04 сверяются как approved-pattern + уточнение 30.10.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { comparePair } from './compare-lib.mjs'

// PNG-кодек поставляется внутри Playwright, как в compare-lib.
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle')

const revision = process.env.US_M02_04_REVISION ?? 'local'
const base = path.resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2', 'us-m02-04')
const referenceDir = `${base}/reference`
const root = `${base}/${revision}`
const viewport = { desktop: 1000, tablet: 1194, phone: 844 }

const hashes = fs
  .readFileSync(`${base}/reference.sha256`, 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split(/\s+/))
fs.mkdirSync(`${root}/reference`, { recursive: true })
const results = []
for (const [hash, name] of hashes) {
  const source = `${referenceDir}/${name}`
  const actual = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  if (actual !== hash) throw new Error(`эталон ${name} изменён: ${actual} ≠ ${hash}`)
  fs.copyFileSync(source, `${root}/reference/${name}`)
  const stem = name.replace(/\.png$/, '')
  const device = stem.split('-')[0]
  const height = (file) => PNG.sync.read(fs.readFileSync(file)).height
  const window = Math.min(viewport[device], height(source), height(`${root}/actual/${name}`))
  results.push(comparePair({ stage: revision, name: stem, region: { y0: 0, y1: window } }, base))
}
const lines = results.map(
  (item) =>
    `${item.id}\t${item.percent.toFixed(2)}%\tкадр ${item.actual.height}\tэталон ${item.reference.height}`,
)
fs.writeFileSync(`${root}/compare-summary.txt`, `${lines.join('\n')}\n`)
fs.writeFileSync(`${root}/compare-summary.json`, JSON.stringify(results, null, 2))
console.log(lines.join('\n'))
