import fs from 'node:fs'
import path from 'node:path'

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
const technicalLayers = ['app', 'shared']

/** Слайс узнаётся по публичному API: папка с `index.ts`. */
const isSlice = (dir) => fs.existsSync(path.join(dir, 'index.ts'))

// Дополняет Steiger: одинаково проверяет imports, re-exports и dynamic import.
// Поддерживает группы слайсов (`features/team/invite-member`): папка группы
// без `index.ts`, внутри — слайсы со своими публичными API.
export const fsdRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      direction: 'FSD: запрещена зависимость от верхнего слоя или соседнего слайса.',
      publicApi: 'FSD: внешний импорт должен проходить через index.ts слайса/сегмента.',
    },
  },
  create(context) {
    const root = path.resolve(context.cwd, 'src')
    const locate = (file) => {
      const relative = path.relative(root, file)
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null
      const [layer, first, second] = relative.split(path.sep)
      if (!layers.includes(layer) || !first) return null
      if (technicalLayers.includes(layer)) return { layer, slice: first }
      const firstDir = path.join(root, layer, first)
      if (second && !isSlice(firstDir) && isSlice(path.join(firstDir, second))) {
        return { layer, slice: path.join(first, second) }
      }
      return { layer, slice: first }
    }
    const file = context.filename
    const from = locate(file)
    if (!from) return {}
    function check(source) {
      if (!source || typeof source.value !== 'string') return
      const specifier = source.value
      const target = specifier.startsWith('@/')
        ? path.resolve(root, specifier.slice(2))
        : specifier.startsWith('.')
          ? path.resolve(path.dirname(file), specifier)
          : null
      if (!target) return
      const to = locate(target)
      if (!to) return
      const sameSlice = from.layer === to.layer && from.slice === to.slice
      const sameTechnicalLayer = from.layer === to.layer && technicalLayers.includes(from.layer)
      if (
        layers.indexOf(to.layer) < layers.indexOf(from.layer) ||
        (from.layer === to.layer && !sameSlice && !sameTechnicalLayer)
      ) {
        context.report({ node: source, messageId: 'direction' })
        return
      }
      if (sameSlice || (from.layer === 'app' && to.layer === 'app')) return
      const apiRoot = path.join(root, to.layer, to.slice)
      if (
        ![apiRoot, path.join(apiRoot, 'index'), path.join(apiRoot, 'index.ts')].includes(target)
      ) {
        context.report({ node: source, messageId: 'publicApi' })
      }
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    }
  },
}
