// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { namedVueUseId, normalizePureAnnotations, treeShakingFixes } from './tree-shaking-fixes'

const read = (path: string) =>
  readFileSync(new URL(`../../node_modules/${path}`, import.meta.url), 'utf8')

describe('treeShakingFixes', () => {
  it('нормализует JSDoc-аннотации PURE vee-validate, не меняя длину строк', () => {
    const source = read('vee-validate/dist/vee-validate.mjs')
    const fixed = normalizePureAnnotations(source)
    expect(fixed).not.toBeNull()
    expect(fixed).not.toMatch(/\/\*\*\s*[#@]__PURE__/)
    expect(fixed!.match(/\/\*\s+#__PURE__ \*\/ defineComponent\(/g)).toHaveLength(4)
    expect(fixed!.length).toBe(source.length)
    expect(fixed!.split('\n').length).toBe(source.split('\n').length)
    expect(normalizePureAnnotations('const a = /* @__PURE__ */ f()')).toBeNull()
  })

  it('заменяет пространство имён vue в useId reka-ui именованным импортом', () => {
    const source = read('reka-ui/dist/shared/useId.js')
    const fixed = namedVueUseId(source)
    expect(fixed).not.toBeNull()
    expect(fixed).toContain('import { useId as vueUseId } from "vue";')
    expect(fixed).toContain('else if (vueUseId) id = vueUseId();')
    expect(fixed).not.toMatch(/import \* as vue|in vue/)
    // Ветка ConfigProvider и запасной счётчик библиотеки остаются.
    expect(fixed).toContain('if (configProviderContext.useId) id = configProviderContext.useId();')
    expect(fixed).toContain('else id = `${++count}`;')
  })

  it('без полного совпадения ничего не меняет', () => {
    expect(namedVueUseId('import * as vue from "vue";')).toBeNull()
    const plugin = treeShakingFixes()
    const transform = plugin.transform as (code: string, id: string) => unknown
    expect(transform('/** #__PURE__ */ f()', '/src/app/main.ts')).toBeNull()
    expect(transform('const a = 1', '/x/node_modules/reka-ui/dist/shared/useId.js')).toBeNull()
    expect(plugin.apply).toBe('build')
  })
})
