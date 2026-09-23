/**
 * Идентификаторы, создаваемые в браузере: `X-Request-ID` для корреляции
 * запросов и ключи идемпотентности команд.
 */

const HEX = '0123456789abcdef'

/**
 * UUID v4. Использует `crypto.randomUUID`, а при его отсутствии собирает
 * значение из `crypto.getRandomValues`, чтобы результат оставался
 * криптографически случайным.
 */
export function createUuid(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  let hex = ''
  for (const byte of bytes) hex += HEX[byte >> 4]! + HEX[byte & 0x0f]!
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
