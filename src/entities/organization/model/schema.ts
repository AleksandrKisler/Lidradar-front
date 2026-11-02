/** Общие ограничения полей компании для создания и изменения. */
import * as v from 'valibot'
import type { Organization, UpdateOrganizationRequest } from './types'

export function organizationValues(
  organization: Pick<Organization, 'name' | 'defaultTimezone' | 'defaultCurrency'>,
) {
  const { name, defaultTimezone, defaultCurrency } = organization
  return { name, defaultTimezone, defaultCurrency }
}

export function organizationFormSchema(emptyName: string) {
  return v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty(emptyName),
      v.maxLength(200, 'Слишком длинное название'),
    ),
    defaultTimezone: v.pipe(v.string(), v.nonEmpty('Выберите часовой пояс')),
    defaultCurrency: v.pipe(v.string(), v.regex(/^[A-Za-z]{3}$/, 'Выберите валюту')),
  })
}

/** Оба редактора отправляют только изменённые поля, валюта нормализуется в код ISO. */
export function organizationChanges(
  organization: Organization,
  values: { name?: string; defaultTimezone?: string; defaultCurrency?: string },
): UpdateOrganizationRequest {
  const normalized = {
    name: (values.name ?? '').trim(),
    defaultTimezone: values.defaultTimezone ?? '',
    defaultCurrency: (values.defaultCurrency ?? '').toUpperCase(),
  }
  return Object.fromEntries(
    Object.entries(normalized).filter(
      ([key, value]) => value !== organization[key as keyof typeof normalized],
    ),
  )
}
