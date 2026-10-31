import { ESLint, RuleTester } from 'eslint'
import assert from 'node:assert/strict'
import { fsdRule } from './fsd.mjs'
import path from 'node:path'
const filename = path.join(process.cwd(), 'src/entities/risk/model/probe.ts')
const cases = {
  valid: [
    { filename, code: "import { x } from '@/shared/ui'" },
    // Группа слайсов: импорт слайса внутри группы через его index.ts.
    {
      filename: path.join(process.cwd(), 'src/pages/settings/ui/probe.ts'),
      code: "import { x } from '@/features/team/invite-member'",
    },
    {
      filename: path.join(process.cwd(), 'src/features/team/invite-member/ui/probe.ts'),
      code: "import { x } from '../model/schema'",
    },
    { filename, code: "import { x } from './risk'" },
    {
      filename: path.join(process.cwd(), 'src/app/router/index.ts'),
      code: "const page = import('@/pages/radar')",
    },
  ],
  invalid: [
    {
      filename: path.join(process.cwd(), 'src/pages/settings/ui/probe.ts'),
      code: "import { x } from '@/features/team/invite-member/ui/InviteMemberDialog.vue'",
      errors: [{ messageId: 'publicApi' }],
    },
    {
      filename: path.join(process.cwd(), 'src/features/team/invite-member/ui/probe.ts'),
      code: "import { x } from '@/features/team/manage-member'",
      errors: [{ messageId: 'direction' }],
    },
    {
      filename,
      code: "import { x } from '@/features/acknowledge-risk'",
      errors: [{ messageId: 'direction' }],
    },
    {
      filename,
      code: "export { x } from '@/features/acknowledge-risk'",
      errors: [{ messageId: 'direction' }],
    },
    { filename, code: "export * from '@/entities/user'", errors: [{ messageId: 'direction' }] },
    { filename, code: "const x = import('@/pages/radar')", errors: [{ messageId: 'direction' }] },
    {
      filename,
      code: "import { x } from '@/shared/ui/UiButton.vue'",
      errors: [{ messageId: 'publicApi' }],
    },
    {
      filename,
      code: "import { x } from '../../../features/acknowledge-risk'",
      errors: [{ messageId: 'direction' }],
    },
  ],
}
new RuleTester().run('fsd', fsdRule, cases)
console.log(`FSD rule: ${cases.valid.length + cases.invalid.length} cases passed`)

const eslint = new ESLint()
assert.equal(await eslint.isPathIgnored('artifacts/frontend-v2/probe.ts'), true)
for (const source of [
  'src/shared/lib/probe.ts',
  'tests/e2e/probe.ts',
  'tooling/probe.mjs',
  'scripts/probe.mjs',
  'eslint.config.js',
]) {
  assert.equal(await eslint.isPathIgnored(source), false, `Lint must include ${source}`)
}
const [sourceProbe] = await eslint.lintText('const unused = 1', {
  filePath: 'src/shared/lib/probe.ts',
})
assert.ok(
  sourceProbe.messages.some((message) => message.ruleId === '@typescript-eslint/no-unused-vars'),
)
console.log('ESLint scope: generated artifacts ignored, source rules remain active')
