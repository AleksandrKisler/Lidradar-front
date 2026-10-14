/**
 * Сохранение файла, полученного запросом с сессией и заголовками: обычная ссылка не умеет `X-Tenant-ID` и
 * подтверждение паролем в теле, поэтому выгрузки (ADR 0059) приходят как `Blob` и отдаются браузеру отсюда.
 */

/** Заменяет всё, что не годится в имени файла, и добавляет запасное имя. */
export function safeFilename(name: string | null, fallback: string): string {
  const cleaned = (name ?? '').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^[._]+/, '')
  return cleaned.length > 0 ? cleaned.slice(0, 120) : fallback
}

/**
 * Предлагает браузеру сохранить `blob` под именем `filename`. Адрес объекта освобождается сразу после
 * запуска загрузки: браузер уже держит данные.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
