/** Объяснение ошибки в окне подтверждения: заголовок, текст и необязательные строки списка. */
export interface FailureView {
  tone: 'warning' | 'danger'
  title: string
  text: string
  lines?: readonly string[]
}
