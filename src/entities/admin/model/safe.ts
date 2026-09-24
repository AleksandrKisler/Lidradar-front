/**
 * Безопасный показ метаданных: идентификаторы сокращаются для чтения (полное
 * значение остаётся в подсказке и копировании), произвольные JSON-значения
 * фактов сериализуются с ограничением длины и никогда не вставляются как HTML.
 */
export function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

/** JSON-представление значения не длиннее `max` символов; несериализуемое — подпись. */
export function safeJson(value: unknown, max = 200): string {
  let text: string
  try {
    text = value === undefined ? 'undefined' : JSON.stringify(value)
    if (typeof text !== 'string') text = String(value)
  } catch {
    text = '[несериализуемое значение]'
  }
  // Управляющие символы не должны ломать разметку и строки таблицы.
  let clean = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    clean += code < 32 && char !== '\n' ? ' ' : char
  }
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}
