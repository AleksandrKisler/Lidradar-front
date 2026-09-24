/**
 * Маскирование персональных данных для подписей интерфейса. Полный телефон
 * или почта показываются только там, где это явно разрешено; подпись контакта
 * по умолчанию скрывает большую часть символов.
 */

/** `+7 (999) 123-45-67` → `••• 45 67`; слишком короткое значение → `•••`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '•••'
  const tail = digits.slice(-4)
  return `••• ${tail.slice(0, 2)} ${tail.slice(2)}`
}

/** `dmitry@example.com` → `d•••@example.com`; без `@` → `•••`. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0 || at === email.length - 1) return '•••'
  return `${email.slice(0, 1)}•••@${email.slice(at + 1)}`
}
