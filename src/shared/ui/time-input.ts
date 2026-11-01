/** Insert the clock separator for a numeric keyboard; range validation stays in the form. */
export function readTimeInput(event: Event): string {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/^(\d{2})(\d{1,2})$/, '$1:$2')
  if (value !== input.value) {
    const start = input.selectionStart
    const end = input.selectionEnd
    input.value = value
    if (start !== null && end !== null)
      input.setSelectionRange(start + Number(start > 2), end + Number(end > 2))
  }
  return value
}
