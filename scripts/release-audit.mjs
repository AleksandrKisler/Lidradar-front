/**
 * Аудит production-сборки перед выпуском:
 * 1) нет карт исходников и служебных адресов разработки в артефактах;
 * 2) `index.html` совместим с CSP `script-src 'self'`: без inline-скриптов и
 *    inline-обработчиков;
 * 3) в бандле нет очевидных секретов (ключи, приватные ключи, пароли стенда);
 * 4) бюджеты сборки соблюдены (`check-bundle.mjs`);
 * 5) типы клиента соответствуют снимку контракта (`api:check`).
 * Запускается после `npm run build:prod`.
 */
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const problems = []

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
const files = walk(dist)

// 1. Карты исходников и адреса разработки.
const maps = files.filter((file) => file.endsWith('.map'))
if (maps.length) problems.push(`карты исходников в production: ${maps.join(', ')}`)
const textFiles = files.filter((file) => /\.(js|css|html)$/.test(file))
const devPatterns = [/127\.0\.0\.1:8081/, /localhost:8081/, /DEV_API_TARGET/]
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8')
  for (const pattern of devPatterns) {
    if (pattern.test(text)) problems.push(`${file}: найден служебный адрес ${pattern}`)
  }
}

// 2. CSP: index.html без inline-скриптов и обработчиков.
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const inlineScripts = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi),
].filter((match) => match[1].trim().length > 0)
if (inlineScripts.length) problems.push('index.html содержит inline-скрипт (несовместимо с CSP)')
if (/\son[a-z]+\s*=\s*["']/i.test(html))
  problems.push('index.html содержит inline-обработчик события')

// 3. Секреты: ключи облаков, приватные ключи, пароль стенда, если файл есть рядом.
const secretPatterns = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /sk_live_[0-9a-zA-Z]{10,}/,
  /ghp_[0-9A-Za-z]{30,}/,
  /\d{6,12}:[A-Za-z0-9_-]{30,}/, // токен Telegram-бота
]
const standPassword = ['../Lidradar/runtime/frontend/password.txt', 'runtime/frontend/password.txt']
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, 'utf8').trim())
  .filter((value) => value.length >= 8)
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8')
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) problems.push(`${file}: строка похожа на секрет (${pattern})`)
  }
  for (const password of standPassword) {
    if (text.includes(password)) problems.push(`${file}: содержит пароль учебного стенда`)
  }
}

// 4–5. Бюджеты и контракт.
for (const [label, command] of [
  ['бюджет сборки', 'node scripts/check-bundle.mjs dist'],
  ['снимок контракта', 'npm run -s api:check'],
]) {
  try {
    execSync(command, { stdio: 'inherit' })
  } catch {
    problems.push(`${label}: проверка не прошла`)
  }
}

if (problems.length) {
  console.error('\nАудит выпуска не пройден:')
  for (const problem of problems) console.error(` - ${problem}`)
  process.exit(1)
}
console.log(
  '\nАудит выпуска пройден: карт нет, CSP-совместимо, секретов не найдено, бюджеты и контракт в норме.',
)
