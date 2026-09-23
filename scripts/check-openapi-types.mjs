// Проверяет, что сгенерированные типы соответствуют снимку контракта.
//
// Генерация повторяется во временный файл и сравнивается с закоммиченным
// `src/shared/api/generated/schema.d.ts`. Любое расхождение означает, что
// кто-то изменил снимок без регенерации или отредактировал типы вручную.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const committed = path.join(root, 'src', 'shared', 'api', 'generated', 'schema.d.ts')
const workdir = mkdtempSync(path.join(tmpdir(), 'lidradar-openapi-'))
const generated = path.join(workdir, 'schema.d.ts')
try {
  const cli = path.join(root, 'node_modules', 'openapi-typescript', 'bin', 'cli.js')
  execFileSync(
    process.execPath,
    [cli, path.join(root, 'contracts', 'openapi.yaml'), '-o', generated],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  )
  if (readFileSync(committed, 'utf8') !== readFileSync(generated, 'utf8')) {
    console.error(
      'Сгенерированные типы устарели или изменены вручную. Выполните `npm run api:generate` и закоммитьте результат.',
    )
    process.exit(1)
  }
  console.log('Типы OpenAPI соответствуют снимку контракта.')
} finally {
  rmSync(workdir, { recursive: true, force: true })
}
