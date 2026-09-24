/** Размер файла по-русски: `512 Б`, `12 КБ`, `1,5 МБ`. */

/** Неразрывный пробел между числом и единицей. */
const NBSP = ' '

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)}${NBSP}Б`
  const units = ['КБ', 'МБ', 'ГБ']
  let value = bytes / 1024
  let unit = units[0]!
  for (const next of units.slice(1)) {
    if (value < 1024) break
    value /= 1024
    unit = next
  }
  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace('.', ',')
  return `${rounded.replace(',0', '')}${NBSP}${unit}`
}
