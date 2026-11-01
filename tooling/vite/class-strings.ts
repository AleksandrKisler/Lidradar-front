import ts from 'typescript'
import type { Plugin } from 'vite'

/** Pool repeated immutable class values within a chunk; never rewrite keys or imports. */
export function poolClassStrings(code: string): string | null {
  const source = ts.createSourceFile(
    'chunk.js',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )
  const values = new Map<string, ts.Node[]>()
  function visit(node: ts.Node, inClass = false) {
    if (
      inClass &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text.length >= 40
    ) {
      const matches = values.get(node.text) ?? []
      matches.push(node)
      values.set(node.text, matches)
    }
    if (ts.isPropertyAssignment(node)) {
      visit(node.initializer, inClass || node.name.getText(source) === 'class')
      return
    }
    // Object keys and import/export specifiers are not class expressions.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return
    ts.forEachChild(node, (child) => visit(child, inClass))
  }
  visit(source)
  const edits: { start: number; end: number; text: string }[] = []
  const declarations: string[] = []
  let index = 0
  for (const [value, nodes] of values) {
    if (nodes.length < 2 || (nodes.length - 1) * value.length < 40) continue
    let name: string
    do name = `$lrClass${index++}`
    while (code.includes(name))
    declarations.push(`${name}=${JSON.stringify(value)}`)
    nodes.forEach((node) => edits.push({ start: node.getStart(source), end: node.end, text: name }))
  }
  if (!edits.length) return null
  // Preserve any directive prologue. ESM import declarations may follow this declaration.
  let insertion = 0
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    insertion = statement.end
  }
  edits.push({ start: insertion, end: insertion, text: `\nconst ${declarations.join(',')};\n` })
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
      code,
    )
}

export function classStrings(): Plugin {
  return {
    name: 'lidradar:class-strings',
    apply: 'build',
    renderChunk(code, _, options) {
      // Development builds retain their original private source maps.
      if (options.sourcemap) return null
      const pooled = poolClassStrings(code)
      return pooled ? { code: pooled, map: null } : null
    },
  }
}
