/**
 * Форматирование денег.
 *
 * API передаёт суммы точными десятичными строками (`"47000.00"`). Значение
 * никогда не превращается в число с плавающей точкой: строка разбирается и
 * группируется по разрядам как текст, поэтому копейки и большие суммы
 * отображаются без потери точности.
 */

const decimalPattern = /^(\d+)(?:\.(\d+))?$/

/** Символы валют, которые показываются вместо кода. */
const currencySymbols: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
  BYN: 'Br',
}

/** Неразрывный пробел между группами разрядов и перед символом валюты. */
const NBSP = ' '

/**
 * Разбивает целую часть на группы по три разряда: `1234567` → `1 234 567`.
 */
function groupThousands(integer: string): string {
  const groups: string[] = []
  for (let end = integer.length; end > 0; end -= 3) {
    groups.unshift(integer.slice(Math.max(0, end - 3), end))
  }
  return groups.join(NBSP)
}

export interface FormatMoneyOptions {
  /**
   * Показывать ли дробную часть. По умолчанию копейки скрываются, если они
   * равны нулю, и показываются полностью, если нет.
   */
  fraction?: 'auto' | 'always' | 'never'
}

/**
 * Форматирует десятичную строку API в человекочитаемую сумму с валютой.
 *
 * @example formatMoney('47000.00', 'RUB') // '47 000 ₽'
 * @example formatMoney('1234.50', 'RUB') // '1 234,50 ₽'
 * @returns строку или `null`, если сумма не является десятичной строкой
 */
export function formatMoney(
  amount: string | null | undefined,
  currency: string,
  options: FormatMoneyOptions = {},
): string | null {
  const formatted = formatAmount(amount, options)
  if (formatted === null) return null
  return `${formatted}${NBSP}${currencySymbols[currency] ?? currency}`
}

/**
 * Сумма без валюты по тем же правилам: `47000.00` → `47 000`,
 * `1234.50` → `1 234,50`. Нужна для диапазонов «от – до» с одной валютой.
 */
export function formatAmount(
  amount: string | null | undefined,
  options: FormatMoneyOptions = {},
): string | null {
  if (amount === null || amount === undefined) return null
  const match = decimalPattern.exec(amount.trim())
  if (!match) return null
  const integer = match[1] ?? '0'
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  const mode = options.fraction ?? 'auto'
  let formatted = groupThousands(integer.replace(/^0+(?=\d)/, ''))
  if (mode === 'always') {
    formatted += `,${(match[2] ?? '').padEnd(2, '0').slice(0, 2)}`
  } else if (mode === 'auto' && fraction !== '') {
    formatted += `,${fraction.padEnd(2, '0')}`
  }
  return formatted
}

/** Возвращает символ валюты или её код, если символ неизвестен. */
export function currencySymbol(currency: string): string {
  return currencySymbols[currency] ?? currency
}

/** Ввод суммы человеком: до 12 разрядов, разделитель — точка или запятая, до двух знаков. */
const amountInputPattern = /^(\d{1,12})(?:[.,](\d{1,2}))?$/

/**
 * Разбирает сумму из поля ввода («31 000,00», «31000.5») в десятичную строку
 * API с двумя знаками («31000.50»). Пробелы между разрядами игнорируются.
 *
 * @returns строку или `null` для пустого, нулевого либо некорректного ввода
 */
export function parseAmount(input: string): string | null {
  const compact = input.replace(/\s/g, '')
  const match = amountInputPattern.exec(compact)
  if (!match) return null
  const integer = (match[1] ?? '0').replace(/^0+(?=\d)/, '')
  const fraction = (match[2] ?? '').padEnd(2, '0')
  if (/^0+$/.test(integer) && /^0+$/.test(fraction)) return null
  return `${integer}.${fraction}`
}
