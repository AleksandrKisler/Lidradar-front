/**
 * Тексты закрытия аккаунта (ADR 0059): срок обезличивания и причины, по которым закрытие невозможно.
 * Время показывается в UTC, как и в письмах: у письма нет часового пояса пользователя, а текст
 * интерфейса и письма не должен называть разные даты.
 */
import type { AccountDeletionBlocker } from '@/entities/session'
import { parseInstant } from '@/shared/lib'

/** Срок между запросом и обезличиванием, сутки (политика retention-v1, ADR 0056). */
export const DELETION_GRACE_DAYS = 30

/**
 * `13 ноября 2026, 09:00 (UTC)`; для нечитаемой даты — тире. Строка собирается из частей даты, а не
 * готовым шаблоном ICU: связка между датой и временем («г. в», «г.,») зависит от браузера, а текст
 * интерфейса и письма должен называть дату одинаково везде.
 */
export function formatDueDate(value: string | null | undefined): string {
  const date = parseInstant(value)
  if (!date) return '—'
  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')} (UTC)`
}

export interface BlockerLine {
  key: string
  text: string
}

/**
 * Человеческие формулировки причин блокировки. Название организации приходит от сервера как есть и
 * выводится только текстом (Vue экранирует его); идентификатора организации в ответе нет.
 */
export function blockerLines(blockers: readonly AccountDeletionBlocker[]): BlockerLine[] {
  return blockers.map((blocker, index) => {
    const key = `${blocker.code}-${index}`
    if (blocker.code === 'PLATFORM_ADMIN') {
      return {
        key,
        text: 'У вас действует право администратора платформы: отозвать его может только оператор.',
      }
    }
    const name = blocker.organizationName ? `«${blocker.organizationName}»` : 'организации'
    return blocker.hasOtherMembers === false
      ? {
          key,
          text: `Вы единственный участник организации ${name}. Закрыть её может только поддержка LidRadar; после этого удаление аккаунта станет доступно.`,
        }
      : {
          key,
          text: `Вы единственный владелец организации ${name}. Передайте владение другому участнику в «Настройки → Команда».`,
        }
  })
}
