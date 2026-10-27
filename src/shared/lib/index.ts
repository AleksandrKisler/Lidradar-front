/**
 * Общие утилиты без знания предметной области LidRadar.
 * Внешние модули импортируют их только отсюда.
 */
export { formatMoney, formatAmount, currencySymbol, parseAmount } from './money'
export type { FormatMoneyOptions } from './money'
export {
  parseInstant,
  formatDateTime,
  formatTime,
  formatLongDateTime,
  formatDayTime,
  formatElapsed,
  formatRelative,
  formatDay,
  dayKey,
  isCalendarDate,
  addDays,
  daysBetween,
  zonedDayStart,
  formatCalendarDate,
} from './date-time'
export { maskPhone, maskEmail } from './privacy'
export { formatBytes } from './files'
export { saveBlob, safeFilename } from './download'
export { sanitizeReturnPath } from './return-path'
export { readFragmentToken, ACCOUNT_TOKEN_PATTERN } from './fragment-token'
export { combineSignals, timeoutSignal, isAbortError, isTimeoutError } from './abort'
export { createUuid } from './id'
export { useRetryAfter } from './retry-after'
export { formatWait } from './format-wait'
export { plural } from './plural'
export { layoutRing, arcPath } from './rings'
export type { RingPiece } from './rings'
