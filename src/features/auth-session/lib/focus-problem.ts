import { nextTick } from 'vue'

/**
 * После неудачной отправки поля снова доступны, а браузер при блокировке полей уже сбросил фокус
 * на документ. Фокус возвращается к первому полю с ошибкой; если ошибка не относится к полю
 * (общий отказ сервера), — к полю из `fallbackSelector` (по умолчанию первое доступное).
 */
export async function focusFirstProblem(
  form: HTMLFormElement | null,
  fallbackSelector = 'input:not([disabled])',
): Promise<void> {
  await nextTick()
  const target =
    form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    form?.querySelector<HTMLElement>(fallbackSelector)
  target?.focus()
}
