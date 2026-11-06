/**
 * Пункты главной навигации и правила их видимости.
 *
 * Скрытие пункта — удобство, а не защита: сервер проверяет право на каждом
 * запросе, а прямой переход показывает состояние «Раздел недоступен».
 * В список входят только реализованные маршруты.
 */
import type { Permission } from '@/entities/session'
import type { GlyphName } from '@/shared/ui'

export interface NavItem {
  to: string
  label: string
  /** Право, без которого пункт не показывается. */
  permission?: Permission
  /** Иконка раздела (экспорт Figma). */
  icon: GlyphName
  /** Группа в боковом меню: основные разделы сверху, настройки внизу. */
  group: 'main' | 'bottom'
  sandbox?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/radar', label: 'Radar', permission: 'risks.read', icon: 'nav-radar', group: 'main' },
  {
    to: '/conversations',
    label: 'Диалоги',
    permission: 'conversation.read',
    icon: 'nav-dialogs',
    group: 'main',
  },
  {
    to: '/analytics',
    label: 'Аналитика',
    permission: 'analytics.read',
    icon: 'nav-analytics',
    group: 'main',
  },
  {
    to: '/integrations',
    label: 'Интеграции',
    permission: 'integration.manage',
    icon: 'nav-integrations',
    group: 'main',
  },
  // Настройки видит каждый участник: менеджеру доступны личные уведомления.
  {
    to: '/sandbox',
    label: 'Песочница',
    permission: 'conversation.read',
    icon: 'nav-dialogs',
    group: 'main',
    sandbox: true,
  },
  { to: '/settings', label: 'Настройки', icon: 'cog', group: 'bottom' },
]

export function visibleNavItems(
  can: (permission: Permission) => boolean,
  sandboxEnabled = false,
): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => (!item.sandbox || sandboxEnabled) && (!item.permission || can(item.permission)),
  )
}

/**
 * Раздел остаётся выбранным на своих вложенных страницах: карточка риска принадлежит
 * Radar (Figma 199:11280), вкладки настроек — «Настройкам».
 */
export function isSectionCurrent(to: string, linkActive: boolean, routeName: unknown): boolean {
  const name = typeof routeName === 'string' ? routeName : ''
  return (
    linkActive ||
    (to === '/radar' && name === 'risk') ||
    (to === '/conversations' && name === 'conversation') ||
    (to === '/settings' && (name === 'settings' || name.startsWith('settings-')))
  )
}
