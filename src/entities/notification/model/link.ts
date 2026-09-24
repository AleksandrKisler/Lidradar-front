/**
 * Одноразовая ссылка привязки открывается только по схемам Telegram:
 * `https:` (t.me) и `tg:`. Любая другая схема из ответа сервера не
 * вставляется в `href` — ссылка считается непригодной.
 */
export function isSafeStartUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'tg:'
  } catch {
    return false
  }
}
