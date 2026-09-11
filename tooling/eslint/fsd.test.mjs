import { RuleTester } from 'eslint'
import { fsdRule } from './fsd.mjs'
import path from 'node:path'
const filename = path.join(process.cwd(), 'src/entities/risk/model/probe.ts')
new RuleTester().run('fsd', fsdRule, {
  valid: [
    { filename, code: "import { x } from '@/shared/ui'" },
    { filename, code: "import { x } from './risk'" },
    {
      filename: path.join(process.cwd(), 'src/app/router/index.ts'),
      code: "const page = import('@/pages/radar')",
    },
  ],
  invalid: [
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
})
console.log('FSD rule: 9 cases passed')
