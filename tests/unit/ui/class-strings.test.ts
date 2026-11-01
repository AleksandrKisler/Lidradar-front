import { describe, expect, it } from 'vitest'
import vm from 'node:vm'
import { poolClassStrings, poolValueStrings } from '../../../tooling/vite/class-strings'

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

describe('primitive expression pooling', () => {
  it('preserves nested expressions, escaped values, computed lookup and object keys', () => {
    const value = 'Настройка сохранена.\nПроверьте правило'
    const code = `"use strict";const $lrValue0='occupied';const values={${JSON.stringify(value)}:17};
      function render(){return [${JSON.stringify(value)}, {title:${JSON.stringify(value)}}, values[${JSON.stringify(value)}],$lrValue0]}
      globalThis.output=render();`
    const pooled = poolValueStrings(code)!
    expect(pooled).toBeTruthy()
    expect(pooled.startsWith('"use strict";')).toBe(true)
    expect(pooled).toContain(`${JSON.stringify(value)}:17`)
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {}
    vm.runInNewContext(code, before)
    vm.runInNewContext(pooled, after)
    expect(JSON.stringify(after.output)).toBe(JSON.stringify(before.output))
  })
  it('shares frequent short tag values without changing keys or generated output', () => {
    const code =
      'const tags={' +
      Array.from({ length: 12 }, (_, index) => `k${index}:"div"`).join(',') +
      '};globalThis.output=Object.values(tags).join(",");'
    const pooled = poolValueStrings(code)!
    expect(pooled).toBeTruthy()
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {}
    vm.runInNewContext(code, before)
    vm.runInNewContext(pooled, after)
    expect(after.output).toBe(before.output)
  })
  it('preserves quoted destructuring keys while sharing computed lookup values', () => {
    const repeats = Array.from({ length: 12 }, () => '"aria-label"').join(',')
    const code = `const source={"aria-label":"Label",nested:{"aria-label":"Nested"}};
      const {"aria-label":label,nested:{"aria-label":nestedLabel}}=source;
      const {["aria-label"]:computed}=source;
      globalThis.output=[label,nestedLabel,computed,${repeats}];`
    const pooled = poolValueStrings(code)!
    expect(pooled).toBeTruthy()
    const before: Record<string, unknown> = {},
      after: Record<string, unknown> = {}
    vm.runInNewContext(code, before)
    vm.runInNewContext(pooled, after)
    expect(JSON.stringify(after.output)).toBe(JSON.stringify(before.output))
  })
  it('leaves module specifiers, dynamic imports, assets, tagged templates and directives intact', () => {
    const path = './assets/SomeDialog-long-name.js'
    const code = `import x from ${JSON.stringify(path)};export {x};
      const load=()=>import(${JSON.stringify(path)});const asset=${JSON.stringify(path)};
      const other=${JSON.stringify(path)};const value=String.raw\`long text\`;`
    expect(poolValueStrings(code)).toBeNull()
    expect(poolValueStrings('"use strict";"use strict";const a={"use strict":1};')).toBeNull()
  })
})
