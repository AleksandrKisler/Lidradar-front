import { describe, expect, it } from 'vitest'
import vm from 'node:vm'
import { poolClassStrings } from '../../../tooling/vite/class-strings'

const classes = 'flex min-w-0 items-center justify-between gap-4 rounded-field bg-paper'
describe('chunk class pooling', () => {
  it('preserves values, nested scopes, escapes and directive prologue', () => {
    const code = `"use strict"; const $lrClass0 = 'occupied';
      const first={class:${JSON.stringify(classes)}};
      function result(){ const local={class:[${JSON.stringify(classes)},'text-ink']};
        return [first.class,local.class.join(' '),$lrClass0]; }
      globalThis.output=result();`
    const actual = poolClassStrings(code)!
    expect(actual).toBeTruthy()
    expect(actual.startsWith('"use strict";')).toBe(true)
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {}
    vm.runInNewContext(code, before)
    vm.runInNewContext(actual, after)
    expect(JSON.stringify(after.output)).toBe(JSON.stringify(before.output))
    expect(actual.split(classes)).toHaveLength(2)
  })
  it('keeps object keys, text, dynamic templates and module specifiers unchanged', () => {
    const code = `import x from ${JSON.stringify(classes)};
      const a={${JSON.stringify(classes)}:1,text:${JSON.stringify(classes)}};
      export {x};`
    expect(poolClassStrings(code)).toBeNull()
    expect(poolClassStrings('const a={class:`flex ${name} items-center`};')).toBeNull()
  })
})
