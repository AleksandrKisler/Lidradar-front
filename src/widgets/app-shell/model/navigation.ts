/**
 * Пункты главной навигации и правила их видимости.
 *
 * Скрытие пункта — удобство, а не защита: сервер проверяет право на каждом
 * запросе, а прямой переход показывает состояние «Раздел недоступен».
 * В список входят только реализованные маршруты.
 */
import type { Permission } from '@/entities/session'

export interface NavItem {
  to: string
  label: string
  /** Право, без которого пункт не показывается. */
  permission?: Permission
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/radar', label: 'Radar', permission: 'risks.read' },
  { to: '/conversations', label: 'Диалоги', permission: 'conversation.read' },
  { to: '/analytics', label: 'Аналитика', permission: 'analytics.read' },
  { to: '/integrations', label: 'Интеграции', permission: 'integration.manage' },
  // Настройки видит каждый участник: менеджеру доступны личные уведомления.
  { to: '/settings', label: 'Настройки' },
]

export function visibleNavItems(can: (permission: Permission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(item.permission))
}
