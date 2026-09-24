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
export { sanitizeReturnPath } from './return-path'
export { combineSignals, timeoutSignal, isAbortError, isTimeoutError } from './abort'
export { createUuid } from './id'
