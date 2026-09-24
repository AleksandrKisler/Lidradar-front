/**
 * Шаги начала работы. Порядок и подписи фиксированы продуктом; выполненность
 * каждого шага выводит сервер из данных (`GET /organization/onboarding`) —
 * клиент ничего не запоминает локально.
 */
import type { OnboardingStatus, OnboardingStepKey } from './types'

export const ONBOARDING_STEP_ORDER: readonly OnboardingStepKey[] = [
  'ORGANIZATION',
  'LOCATION',
  'SERVICES',
  'CHANNEL',
  'TELEGRAM_LINK',
]

const labels: Record<OnboardingStepKey, string> = {
  ORGANIZATION: 'Компания',
  LOCATION: 'Точка и график',
  SERVICES: 'Услуги и цены',
  CHANNEL: 'Источник сообщений',
  TELEGRAM_LINK: 'Уведомления в Telegram',
}

export function onboardingStepLabel(key: OnboardingStepKey | string): string {
  return labels[key as OnboardingStepKey] ?? key
}

/** Выполнен ли шаг по серверному статусу; без статуса ничего не выполнено. */
export function isOnboardingStepDone(
  status: OnboardingStatus | null,
  key: OnboardingStepKey,
): boolean {
  return status?.steps.some((step) => step.key === key && step.done) ?? false
}
