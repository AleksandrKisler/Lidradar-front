/**
 * Цены каталога — точные десятичные строки или `null`, когда цена неизвестна.
 * Неизвестная граница никогда не показывается нулём, а диапазон не сводится
 * к средней сумме.
 */
import { currencySymbol, formatAmount, formatMoney } from '@/shared/lib'

export const UNKNOWN_PRICE = 'Не указана'

export function formatPriceRange(
  priceFrom: string | null,
  priceTo: string | null,
  currency: string,
): string {
  if (priceFrom === null && priceTo === null) return UNKNOWN_PRICE
  if (priceFrom !== null && priceTo !== null) {
    if (Number(priceFrom) === Number(priceTo))
      return formatMoney(priceFrom, currency) ?? UNKNOWN_PRICE
    const from = formatAmount(priceFrom)
    const to = formatAmount(priceTo)
    if (from === null || to === null) return UNKNOWN_PRICE
    return `${from}–${to}\u00a0${currencySymbol(currency)}`
  }
  if (priceFrom !== null) return `от ${formatMoney(priceFrom, currency) ?? UNKNOWN_PRICE}`
  return `до ${formatMoney(priceTo, currency) ?? UNKNOWN_PRICE}`
}

/** Нижняя граница не выше верхней; сравнение по десятичной строке без float-накопления. */
export function priceRangeValid(priceFrom: string | null, priceTo: string | null): boolean {
  if (priceFrom === null || priceTo === null) return true
  return Number(priceFrom) <= Number(priceTo)
}
