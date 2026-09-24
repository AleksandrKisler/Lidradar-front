/** Разделы администрирования; только реализованные маршруты. */
export interface AdminSection {
  name: string
  label: string
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { name: 'admin-overview', label: 'Обзор' },
  { name: 'admin-organizations', label: 'Организации' },
  { name: 'admin-connections', label: 'Подключения' },
  { name: 'admin-jobs', label: 'Задания' },
  { name: 'admin-dead-letters', label: 'Мёртвые письма' },
  { name: 'admin-ai', label: 'AI' },
  { name: 'admin-usage', label: 'Потребление' },
  { name: 'admin-trace', label: 'Трассировка' },
  { name: 'admin-admins', label: 'Администраторы' },
]
