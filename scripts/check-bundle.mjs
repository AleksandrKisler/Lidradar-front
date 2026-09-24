/**
 * Проверка бюджета сборки по манифесту Vite: входной чанк, самый большой чанк,
 * CSS и суммарный JavaScript не превышают порогов из `bundle-budgets.json`.
 * Отдельно проверяется, что критическая загрузка не тянет чанки
 * администрирования статически: они должны оставаться динамическими импортами.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'))
const budgets = JSON.parse(readFileSync('bundle-budgets.json', 'utf8')).budgets

const size = (file) => statSync(join(dist, file)).size
const entry = Object.values(manifest).find((chunk) => chunk.isEntry)
if (!entry) throw new Error('В манифесте нет входного чанка')

const assets = readdirSync(join(dist, 'assets'))
const jsFiles = assets.filter((name) => name.endsWith('.js'))
const cssFiles = assets.filter((name) => name.endsWith('.css'))
const entrySize = size(entry.file)
const largest = jsFiles
  .map((name) => ({ name, size: size(join('assets', name)) }))
  .sort((left, right) => right.size - left.size)[0]
const cssSize = cssFiles.reduce((sum, name) => sum + size(join('assets', name)), 0)
const totalJs = jsFiles.reduce((sum, name) => sum + size(join('assets', name)), 0)

/** Статический граф импортов входа: транзитивно по `imports`, без динамических. */
const staticGraph = new Set()
const walk = (key) => {
  const chunk = manifest[key]
  if (!chunk) return
  for (const dependency of chunk.imports ?? []) {
    if (staticGraph.has(dependency)) continue
    staticGraph.add(dependency)
    walk(dependency)
  }
}
const entryKey = Object.keys(manifest).find((key) => manifest[key] === entry)
walk(entryKey)
const adminInBoot = [...staticGraph].filter((key) => /admin/i.test(key))

const checks = [
  ['входной чанк', entrySize, budgets.entry],
  [`самый большой чанк (${largest.name})`, largest.size, budgets.largestChunk],
  ['CSS', cssSize, budgets.css],
  ['весь JavaScript', totalJs, budgets.totalJs],
]
let failed = false
for (const [label, actual, budget] of checks) {
  const ok = actual <= budget
  if (!ok) failed = true
  console.log(`${ok ? 'OK ' : 'FAIL'} ${label}: ${actual} байт (бюджет ${budget})`)
}
if (adminInBoot.length > 0) {
  failed = true
  console.log(`FAIL чанки администрирования в критической загрузке: ${adminInBoot.join(', ')}`)
} else {
  console.log('OK  администрирование не входит в критическую загрузку')
}
if (failed) {
  console.error('Бюджет сборки нарушен: обновите bundle-budgets.json только вместе с обоснованием.')
  process.exit(1)
}
