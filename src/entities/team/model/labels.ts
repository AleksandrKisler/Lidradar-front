/** Подписи состояний участников и приглашений; цвет никогда не единственный носитель смысла. */
import type { InvitationStatus, MemberStatus, TeamRole } from './types'

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info'

const memberStatusLabels: Record<MemberStatus, string> = {
  ACTIVE: 'Активен',
  INVITED: 'Приглашён',
  DISABLED: 'Доступ отозван',
}

const memberStatusTones: Record<MemberStatus, Tone> = {
  ACTIVE: 'success',
  INVITED: 'info',
  DISABLED: 'neutral',
}

const invitationStatusLabels: Record<InvitationStatus, string> = {
  PENDING: 'Ожидает',
  ACCEPTED: 'Принято',
  REVOKED: 'Отозвано',
  EXPIRED: 'Истекло',
}

const invitationStatusTones: Record<InvitationStatus, Tone> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REVOKED: 'neutral',
  EXPIRED: 'neutral',
}

export function memberStatusLabel(value: MemberStatus | string): string {
  return memberStatusLabels[value as MemberStatus] ?? value
}

export function memberStatusTone(value: MemberStatus | string): Tone {
  return memberStatusTones[value as MemberStatus] ?? 'neutral'
}

export function invitationStatusLabel(value: InvitationStatus | string): string {
  return invitationStatusLabels[value as InvitationStatus] ?? value
}

export function invitationStatusTone(value: InvitationStatus | string): Tone {
  return invitationStatusTones[value as InvitationStatus] ?? 'neutral'
}

/** Что даёт роль (макет 12): показывается рядом со списком участников. */
export const ROLE_CAPABILITIES: Record<TeamRole, { can: string[]; cannot: string[] }> = {
  OWNER: {
    can: [
      'Работает с рисками, диалогами и оплатами',
      'Настраивает компанию, услуги и интеграции',
      'Управляет доступом команды',
      'Просматривает аналитику',
    ],
    cannot: [],
  },
  MANAGER: {
    can: ['Работает с рисками и диалогами', 'Фиксирует действия, результаты и оплаты'],
    cannot: ['Не меняет настройки компании, интеграции, уведомления и состав команды'],
  },
}
