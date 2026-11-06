/**
 * Инициалы для круглой кнопки аккаунта в шапке телефона (Figma 1048:9359).
 * Берутся из настоящего имени пользователя: первые буквы двух первых слов,
 * у имени из одного слова — первая буква. Без имени — пустая строка, а не
 * выдуманные буквы; доступное имя кнопки «Аккаунт» при этом сохраняется.
 */
export function accountInitials(displayName: string | null | undefined): string {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase('ru-RU')
}
