// Копирует снимок контракта OpenAPI из локальной копии репозитория бэкенда.
//
// Использование:
//   LIDRADAR_BACKEND_DIR=/path/to/backend npm run api:sync
//   npm run api:sync -- /path/to/backend
//
// После синхронизации выполните `npm run api:generate` и закоммитьте оба файла:
// снимок и сгенерированные типы. CI сверяет их командой `npm run api:check`.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = process.argv[2] ?? process.env.LIDRADAR_BACKEND_DIR
if (!backendDir) {
  console.error('Укажите каталог бэкенда: аргументом команды или переменной LIDRADAR_BACKEND_DIR.')
  process.exit(1)
}
const source = path.join(backendDir, 'contracts', 'openapi', 'openapi.yaml')
if (!existsSync(source)) {
  console.error(`Файл контракта не найден: ${source}`)
  process.exit(1)
}
const target = path.join(root, 'contracts', 'openapi.yaml')
copyFileSync(source, target)

let commit = 'unknown'
try {
  commit = execFileSync('git', ['-C', backendDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = execFileSync(
    'git',
    ['-C', backendDir, 'status', '--porcelain', '--', 'contracts/openapi/openapi.yaml'],
    {
      encoding: 'utf8',
    },
  ).trim()
  if (dirty) commit += ' (с незакоммиченными изменениями контракта)'
} catch {
  // Каталог без git: фиксируем только время синхронизации.
}
writeFileSync(
  path.join(root, 'contracts', 'source.json'),
  `${JSON.stringify({ backendCommit: commit, syncedAt: new Date().toISOString() }, null, 2)}\n`,
)
console.log(`Контракт скопирован из ${source}\nКоммит бэкенда: ${commit}`)
