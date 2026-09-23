/**
 * Безопасный путь возврата после входа.
 *
 * Значение приходит из query-параметра `redirect`, то есть из адресной
 * строки, и не может считаться доверенным: принимаются только внутренние
 * пути приложения. Абсолютные URL, схемы и protocol-relative ссылки
 * (`//evil.test`) отбрасываются, чтобы исключить open redirect.
 */
export function sanitizeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null
  if (hasControlCharacters(trimmed)) return null
  return trimmed
}

/** Управляющие символы (включая переводы строк) в пути — признак подделки адреса. */
function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}
