import type { Plugin } from 'vite'

/**
 * Точечные правки зависимостей при сборке, которые не меняют поведение, но дают Rolldown выбросить
 * неиспользуемый код (бюджет «весь JavaScript» в `audit:release`). Каждая правка применяется,
 * только если исходный текст найден целиком; иначе модуль остаётся как есть, а рост размера
 * покажет аудит сборки.
 */

/**
 * Rolldown распознаёт `/* @__PURE__ *\/` и `/*#__PURE__*\/`, но не JSDoc-форму `/** #__PURE__ *\/`.
 * Её использует vee-validate: без нормализации неиспользуемые Field, Form, FieldArray и
 * ErrorMessage остаются в сборке (около 15 KB). Длина строки та же, позиции кода не сдвигаются.
 */
const JSDOC_PURE = /\/\*\*(\s*[#@]__PURE__\s*\*\/)/g

export function normalizePureAnnotations(code: string): string | null {
  const normalized = code.replace(JSDOC_PURE, '/* $1')
  return normalized === code ? null : normalized
}

/**
 * reka-ui `shared/useId.js` проверяет `"useId" in vue` на пространстве имён `import * as vue`.
 * Оператор `in` заставляет сохранить объект со всеми экспортами Vue (SSR, гидрация, Transition,
 * KeepAlive и т. д.) — около 39 KB. В Vue 3.5 `useId` есть всегда, поэтому достаточно именованного
 * импорта; ветка ConfigProvider и запасной счётчик библиотеки сохраняются.
 */
const REKA_USE_ID = [
  ['import * as vue from "vue";', 'import { useId as vueUseId } from "vue";'],
  ['else if ("useId" in vue) id = vue.useId?.();', 'else if (vueUseId) id = vueUseId();'],
] as const

export function namedVueUseId(code: string): string | null {
  if (!REKA_USE_ID.every(([from]) => code.includes(from))) return null
  return REKA_USE_ID.reduce((result, [from, to]) => result.replace(from, to), code)
}

export function treeShakingFixes(): Plugin {
  return {
    name: 'lidradar:tree-shaking-fixes',
    enforce: 'pre',
    apply: 'build',
    transform(code, id) {
      if (!id.includes('/node_modules/')) return null
      const fixed = id.includes('/reka-ui/dist/shared/useId.')
        ? namedVueUseId(code)
        : normalizePureAnnotations(code)
      return fixed === null ? null : { code: fixed, map: null }
    },
  }
}
