/**
 * Сверка кадров US-M01-01 с эталонами Figma и обязательная геометрия.
 * Использование: `US_M01_01_REVISION=R2-codex node tooling/visual/us-m01-01-compare.mjs`.
 *
 * Входы: `artifacts/frontend-v2/us-m01-01/reference/*.png` (+ `reference.sha256`) и кадры
 * `artifacts/frontend-v2/us-m01-01/<revision>/actual/*.png` с `*.geometry.json`
 * (`us-m01-01.capture.spec.ts`). Выходы рядом с кадрами ревизии:
 * - `reference/` — копии эталонов, проверенных по SHA-256;
 * - `diff/<имя>_<y0>-<y1>.{a,r,d}.png` — кадр, эталон и красным расхождение канала > 24/255;
 * - `compare-summary.txt` и `compare-summary.json` — доли расхождения и проверки геометрии.
 *
 * Мобильные эталоны 390×844 обрезаны по viewport: сравнивается первое окно `[0, 844)`, хвост
 * документа — только геометрией. Кадры без pixel-эталона (сбой и 429 проверки, общая ошибка на
 * планшете/телефоне, 375 px) проверяются геометрией и сверяются по образцу вручную.
 * Доля расхождения — ориентир, не вердикт. Ненулевой код: нет кадра или эталона, неверный
 * хеш эталона, ошибка области сравнения или нарушение обязательной геометрии.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { VisualCompareError, comparePair } from './compare-lib.mjs'

const revision = process.env.US_M01_01_REVISION ?? 'local'
const base = path.resolve(process.env.VISUAL_OUT ?? 'artifacts/frontend-v2', 'us-m01-01')
const referenceDir = `${base}/reference`
const revisionDir = `${base}/${revision}`
const actualDir = `${revisionDir}/actual`

/** Состояния матрицы, которые обязаны быть сняты (совпадает с `us-m01-01.capture.spec.ts`). */
const STATES = [
  'login',
  'b2-default',
  'b2-empty',
  'b2-format',
  'b2-check',
  'b2-skeleton',
  'b2-403',
  'b2-service',
  'b2-429',
  'b3-default',
  'b3-email-error',
  'b3-submitting',
  'b3-skeleton',
  'b3-generic-error',
  'a-default',
  'a-email-error',
  'a-submitting',
  'a-skeleton',
  'a-generic-error',
  'c-default',
  'c-skeleton',
]
const EXPECTED = [
  ...STATES.map((state) => `desktop-${state}`),
  ...STATES.map((state) => `tablet-${state}`),
  ...STATES.map((state) => `mobile-${state}`),
  ...STATES.map((state) => `375-${state}`),
  'desktop-footer-forgot',
  'desktop-footer-reset',
  'desktop-footer-reset-invalid',
  'desktop-footer-verify',
  'tablet-footer-forgot',
  'mobile-footer-forgot',
]
/** Ширина карточки и поля по согласованным кадрам (512/448, 358/310) и регрессия 375. */
const WIDTHS = {
  desktop: { card: 512, field: 448 },
  tablet: { card: 512, field: 448 },
  mobile: { card: 358, field: 310 },
  375: { card: 343, field: 295 },
}
const NOTES = {
  'tablet-login':
    'кадр 464:6336 «Актуально»: вторая ссылка входа сверяется по образцу desktop 773:6361',
  'mobile-login': 'кадр 464:8980: вторая ссылка входа — по образцу desktop',
  'desktop-a-generic-error':
    'US-M01-02 861:5164: карточка в макете смещена вверх относительно центра',
  'desktop-b3-generic-error':
    'US-M01-02 861:4730: карточка в макете смещена вверх относительно центра',
}

const lines = []
const log = (line) => {
  console.log(line)
  lines.push(line)
}
const report = { revision, frames: [], errors: [] }
let failures = 0
const fail = (message) => {
  failures++
  report.errors.push(message)
  log(`ОШИБКА ${message}`)
}

/* ---------- эталоны: хеш и копия в ревизию ---------- */

const sums = new Map(
  fs
    .readFileSync(`${base}/reference.sha256`, 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .map(([sum, file]) => [file.replace(/^\*/, ''), sum]),
)
fs.mkdirSync(`${revisionDir}/reference`, { recursive: true })
for (const [file, sum] of sums) {
  const source = `${referenceDir}/${file}`
  if (!fs.existsSync(source)) {
    fail(`нет эталона ${file}`)
    continue
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  if (actual !== sum) {
    fail(`хеш эталона ${file} не совпадает с reference.sha256`)
    continue
  }
  fs.copyFileSync(source, `${revisionDir}/reference/${file}`)
}

/* ---------- геометрия ---------- */

const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance
const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

function geometryChecks(name, g) {
  const device = name.split('-')[0]
  const checks = []
  const check = (label, ok, detail) => checks.push({ label, ok: Boolean(ok), detail })
  check(
    'нет горизонтального переполнения',
    !g.horizontalOverflow,
    `${g.document.scrollWidth}/${g.document.clientWidth}`,
  )
  const authPage = g.footer.product !== null
  if (g.card && authPage && !name.includes('footer')) {
    check(
      `ширина карточки ${WIDTHS[device].card}`,
      near(g.card.width, WIDTHS[device].card, 1),
      g.card.width,
    )
  }
  for (const field of g.fields) {
    check(`поле ${field.name}: высота 46`, near(field.height, 46), field.height)
    check(
      `поле ${field.name}: рамка 1 px`,
      field.borders.every((value) => value === '1px'),
      field.borders.join(' '),
    )
    if (!name.includes('footer') && !name.includes('login')) {
      check(
        `поле ${field.name}: ширина ${WIDTHS[device].field}`,
        near(field.width, WIDTHS[device].field, 1),
        field.width,
      )
    }
  }
  if (name.endsWith('-c-default')) {
    check(
      'C: одинаковый цвет placeholder всех трёх полей',
      g.fields.length === 3 &&
        g.fields.every(
          (field) =>
            typeof field.placeholderColor === 'string' &&
            field.placeholderColor === g.fields[0].placeholderColor,
        ),
      g.fields.map((field) => `${field.name}: ${field.placeholderColor}`).join('; '),
    )
  }
  for (const [index, block] of g.skeletonFields.entries()) {
    check(`каркас поля ${index + 1}: высота 46`, near(block.height, 46), block.height)
  }
  if (/-(a|b3|c)-skeleton$/.test(name)) {
    check(
      'три placeholder поля аккаунта',
      g.accountPlaceholderRadii?.length === 3,
      g.accountPlaceholderRadii,
    )
    for (const [index, radius] of (g.accountPlaceholderRadii ?? []).entries()) {
      check(`placeholder ${index + 1}: радиус Figma 4 px`, near(radius, 4, 0.5), radius)
    }
  }
  if (/^desktop-(a|b3)-generic-error$/.test(name)) {
    check(
      'neutral error: верх карточки exact-frame y=56',
      g.card && near(g.card.y, 56, 1),
      g.card?.y,
    )
  }
  if (g.code) {
    const { field, wrapper, action, face, icon, spinner } = g.code
    if (spinner) {
      check(
        'код: индикатор 20×20 (не 16)',
        spinner.width === '20px' && spinner.height === '20px',
        `${spinner.width}×${spinner.height}`,
      )
    }
    check('код: обёртка поля 46 (не 56)', near(wrapper.height, 46), wrapper.height)
    check(
      'код: область нажатия 44×44',
      near(action.width, 44) && near(action.height, 44),
      `${action.width}×${action.height}`,
    )
    check(
      'код: видимая кнопка 36×36',
      near(face.width, 36) && near(face.height, 36),
      `${face.width}×${face.height}`,
    )
    check(
      'код: пиктограмма/индикатор 20×20',
      near(icon.width, 20) && near(icon.height, 20),
      `${icon.width}×${icon.height}`,
    )
    for (const [label, inner] of [
      ['кнопка', face],
      ['пиктограмма', icon],
    ]) {
      const c = centre(inner)
      const a = centre(action)
      check(
        `код: ${label} по центру области`,
        near(c.x, a.x) && near(c.y, a.y),
        `Δ${(c.x - a.x).toFixed(2)},${(c.y - a.y).toFixed(2)}`,
      )
    }
    check(
      'код: центр действия = центр поля по вертикали',
      near(centre(action).y, centre(field).y),
      centre(action).y - centre(field).y,
    )
    check(
      'код: кнопка в 5 px от правого края поля',
      near(field.x + field.width - (face.x + face.width), 5),
      field.x + field.width - (face.x + face.width),
    )
  }
  // В B2 единственный submit — встроенная проверка кода 44×44, уже проверенная выше.
  // Основное действие формы аккаунта обязательно и имеет высоту 46 во всех её состояниях.
  const accountForm = /-(a|b3)-(default|email-error|submitting|generic-error)$/.test(name)
  if (accountForm) check('основная кнопка присутствует', g.submit !== null, g.submit)
  if (g.submit && !g.code) {
    check('основная кнопка 46', near(g.submit.height, 46), g.submit.height)
  }
  if (g.warning && g.card) {
    check(
      'warning над карточкой, отступ 24',
      near(g.card.y - (g.warning.y + g.warning.height), 24, 1),
      g.card.y - (g.warning.y + g.warning.height),
    )
  }
  const legal = g.footer.legal
  if (authPage && legal.length === 2) {
    if (device === 'desktop') {
      const [terms, privacy] = legal
      const product = g.footer.product
      check('desktop: подпись продукта в 64 px от левого края', near(product.x, 64, 1), product.x)
      check(
        'desktop: правовые ссылки в 64 px от правого края',
        near(g.viewport.width - (privacy.x + privacy.width), 64, 1),
        g.viewport.width - (privacy.x + privacy.width),
      )
      check(
        'desktop: 24 px между правовыми ссылками',
        near(privacy.x - (terms.x + terms.width), 24, 1),
        privacy.x - (terms.x + terms.width),
      )
      check(
        'desktop: одна нижняя строка с подписью продукта',
        near(terms.y, product.y, 1) && near(privacy.y, product.y, 1),
        `${terms.y}/${privacy.y}/${product.y}`,
      )
      if (g.document.scrollHeight <= g.viewport.height) {
        check('desktop: нижняя строка на y=934', near(product.y, 934, 1), product.y)
      }
    } else {
      for (const [index, link] of legal.entries()) {
        check(`правовая ссылка ${index + 1}: высота 46`, near(link.height, 46), link.height)
      }
      if (g.card) {
        check(
          'правовые ссылки под карточкой (≥24 px)',
          legal[0].y >= g.card.y + g.card.height + 23,
          legal[0].y - (g.card.y + g.card.height),
        )
      }
    }
  }
  return checks
}

/* ---------- кадры ---------- */

const actualFiles = fs.existsSync(actualDir)
  ? fs.readdirSync(actualDir).filter((file) => file.endsWith('.png'))
  : []
for (const name of EXPECTED) {
  if (!actualFiles.includes(`${name}.png`)) fail(`нет кадра ${name}.png в ${actualDir}`)
}

for (const name of EXPECTED.filter((item) => actualFiles.includes(`${item}.png`))) {
  const frame = { name, reference: null, pixel: null, geometry: [], note: NOTES[name] ?? null }
  const referenceFile = `${revisionDir}/reference/${name}.png`
  if (fs.existsSync(referenceFile)) {
    frame.reference = `reference/${name}.png`
    try {
      const height = readHeight(referenceFile)
      const result = comparePair(
        { stage: revision, name, region: { y0: 0, y1: height }, note: frame.note ?? undefined },
        base,
      )
      frame.pixel = {
        region: result.actual.region,
        actualHeight: result.actual.height,
        referenceHeight: result.reference.height,
        percent: Number(result.percent.toFixed(2)),
        diff: `diff/${name}_${result.actual.region.y0}-${result.actual.region.y1}.d.png`,
      }
      log(
        `${name}: расхождение ${result.percent.toFixed(2)} % в [0, ${height})` +
          (result.actual.height > height
            ? `, хвост ${result.actual.height - height} px — геометрией`
            : '') +
          (frame.note ? ` — ${frame.note}` : ''),
      )
    } catch (error) {
      if (!(error instanceof VisualCompareError)) throw error
      fail(error.message)
    }
  } else {
    log(`${name}: pixel-эталона нет — сверка по образцу и геометрией`)
  }
  const geometryFile = `${actualDir}/${name}.geometry.json`
  if (!fs.existsSync(geometryFile)) {
    fail(`нет замеров ${geometryFile}`)
  } else {
    frame.geometry = geometryChecks(name, JSON.parse(fs.readFileSync(geometryFile, 'utf8')))
    for (const row of frame.geometry.filter((item) => !item.ok)) {
      fail(`${name}: геометрия «${row.label}» — ${row.detail}`)
    }
  }
  report.frames.push(frame)
}

function readHeight(file) {
  // Высота PNG — в заголовке IHDR (байты 20–23), без декодирования изображения.
  return fs.readFileSync(file).readUInt32BE(20)
}

fs.writeFileSync(`${revisionDir}/compare-summary.txt`, lines.join('\n') + '\n')
fs.writeFileSync(`${revisionDir}/compare-summary.json`, JSON.stringify(report, null, 2) + '\n')
console.log(`\nКадров: ${report.frames.length}; ошибок входов/геометрии: ${failures}`)
if (failures > 0) process.exit(1)
