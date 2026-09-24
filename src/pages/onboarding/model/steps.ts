/**
 * Соответствие серверных шагов начала работы маршрутам приложения. Шаги
 * подключения канала и личной привязки Telegram пока ведут на итоговую
 * страницу: их экраны появятся вместе с блоками интеграций и уведомлений.
 */
import type { OnboardingStepKey } from '@/entities/organization'

const routes: Record<OnboardingStepKey, string> = {
  ORGANIZATION: 'onboarding-company',
  LOCATION: 'onboarding-location',
  SERVICES: 'onboarding-services',
  CHANNEL: 'onboarding-channel',
  TELEGRAM_LINK: 'onboarding-channel',
}

/** Имя маршрута шага; завершённая настройка (`null`) ведёт на итог. */
export function routeForStep(step: OnboardingStepKey | null): string {
  return step ? routes[step] : 'onboarding-channel'
}
