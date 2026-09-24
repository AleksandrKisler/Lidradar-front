/**
 * Черновик настройки одного типа риска. Сервер принимает только полное тело:
 * редактирование любого поля отправляет всю строку. Тихие часы требуют обе
 * границы и различные значения; конец раньше начала означает интервал через
 * полночь — это допустимо и подписывается явно.
 */
import {
  CLOCK_TIME_PATTERN,
  type NotificationPreference,
  type NotificationPreferenceRequest,
} from './types'

export interface PreferenceDraft {
  minimumSeverity: NotificationPreference['minimumSeverity']
  deliveryMode: NotificationPreference['deliveryMode']
  inAppEnabled: boolean
  telegramEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  digestTime: string
}

export function draftFromPreference(preference: NotificationPreference): PreferenceDraft {
  return {
    minimumSeverity: preference.minimumSeverity,
    deliveryMode: preference.deliveryMode,
    inAppEnabled: preference.inAppEnabled,
    telegramEnabled: preference.telegramEnabled,
    quietHoursEnabled: preference.quietHoursEnabled,
    quietHoursStart: preference.quietHoursStart ?? '',
    quietHoursEnd: preference.quietHoursEnd ?? '',
    digestTime: preference.digestTime,
  }
}

export type PreferenceField = 'quietHoursStart' | 'quietHoursEnd' | 'digestTime'

/** Ошибки по полям; пустой объект — черновик можно отправлять. */
export function validateDraft(draft: PreferenceDraft): Partial<Record<PreferenceField, string>> {
  const errors: Partial<Record<PreferenceField, string>> = {}
  if (draft.quietHoursEnabled) {
    if (!CLOCK_TIME_PATTERN.test(draft.quietHoursStart)) errors.quietHoursStart = 'Укажите начало'
    if (!CLOCK_TIME_PATTERN.test(draft.quietHoursEnd)) errors.quietHoursEnd = 'Укажите конец'
    if (
      !errors.quietHoursStart &&
      !errors.quietHoursEnd &&
      draft.quietHoursStart === draft.quietHoursEnd
    ) {
      errors.quietHoursEnd = 'Границы тихих часов должны различаться'
    }
  }
  if (draft.deliveryMode === 'DIGEST' && !CLOCK_TIME_PATTERN.test(draft.digestTime)) {
    errors.digestTime = 'Укажите время сводки'
  }
  return errors
}

/** Полное тело PUT: у выключенных тихих часов границы не отправляются. */
export function toPreferenceRequest(draft: PreferenceDraft): NotificationPreferenceRequest {
  const body: NotificationPreferenceRequest = {
    minimumSeverity: draft.minimumSeverity,
    deliveryMode: draft.deliveryMode,
    inAppEnabled: draft.inAppEnabled,
    telegramEnabled: draft.telegramEnabled,
    quietHoursEnabled: draft.quietHoursEnabled,
    digestTime: CLOCK_TIME_PATTERN.test(draft.digestTime) ? draft.digestTime : '09:00',
  }
  if (draft.quietHoursEnabled) {
    body.quietHoursStart = draft.quietHoursStart
    body.quietHoursEnd = draft.quietHoursEnd
  }
  return body
}

export function sameDraft(left: PreferenceDraft, right: PreferenceDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Настройка не менялась на сервере: перечитывание списка после сохранения
 * другой строки не должно стирать черновик этой.
 */
export function samePreference(
  left: NotificationPreference,
  right: NotificationPreference,
): boolean {
  return (
    left.isDefault === right.isDefault &&
    (left.updatedAt ?? null) === (right.updatedAt ?? null) &&
    sameDraft(draftFromPreference(left), draftFromPreference(right))
  )
}

/** Подпись интервала тихих часов с пометкой перехода через полночь. */
export function describeQuietHours(start: string, end: string): string {
  const overnight = end < start
  return `${start}–${end}${overnight ? ', через полночь' : ''}`
}
