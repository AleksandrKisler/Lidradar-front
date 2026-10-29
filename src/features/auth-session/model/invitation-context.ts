/**
 * Контекст проверенного приглашения (ADR 0067, US-M01-01 AC-B14): удобство вкладки, а не
 * доказательство пригодности кода. Хранится только в `sessionStorage` этой вкладки как
 * версионированная запись `{ code, checkedAt }` — без имени, почты, пароля, роли или организации.
 *
 * Срок — 30 минут от первой успешной проверки; перепроверка и перезагрузка его не продлевают.
 * Запись принимается только целиком корректной: известная версия, ровно два поля, код
 * допустимого формата, конечное время не из будущего и не старше срока. Всё прочее считается
 * отсутствием контекста и удаляется. Недоступное хранилище не ломает сценарий: страница
 * работает с контекстом в памяти, а после перезагрузки потребуется ввести код снова.
 */
import { INVITATION_CODE_PATTERN } from '@/entities/team'

export const INVITATION_CONTEXT_KEY = 'lidradar.registration.invitation'
export const INVITATION_CONTEXT_VERSION = 1
/** Клиентский срок удобства; не срок действия приглашения на сервере. */
export const INVITATION_CONTEXT_TTL_MS = 30 * 60_000

export interface InvitationContext {
  /** Нормализованный код, прошедший серверную проверку. */
  code: string
  /** Момент первой успешной проверки этого кода, мс Unix. */
  checkedAt: number
}

/** Действует ли контекст в момент `now`: время конечное, не из будущего, срок не истёк. */
export function isInvitationContextFresh(checkedAt: number, now: number): boolean {
  return (
    Number.isFinite(checkedAt) && checkedAt <= now && now - checkedAt < INVITATION_CONTEXT_TTL_MS
  )
}

/** Разбор сохранённой строки; любое отклонение от схемы — `null`. */
export function parseInvitationContext(raw: string | null, now: number): InvitationContext | null {
  if (raw === null) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).sort().join(',') !== 'checkedAt,code,v') return null
  if (record.v !== INVITATION_CONTEXT_VERSION) return null
  const { code, checkedAt } = record
  if (typeof code !== 'string' || !INVITATION_CODE_PATTERN.test(code)) return null
  if (typeof checkedAt !== 'number' || !isInvitationContextFresh(checkedAt, now)) return null
  return { code, checkedAt }
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Удаляет запись; недоступное хранилище — не ошибка. */
export function clearInvitationContext(): void {
  try {
    storage()?.removeItem(INVITATION_CONTEXT_KEY)
  } catch {
    // Хранилище запрещено: записи там и нет.
  }
}

/** Читает действующий контекст; испорченная или истёкшая запись удаляется. */
export function readInvitationContext(now: number = Date.now()): InvitationContext | null {
  let raw: string | null
  try {
    raw = storage()?.getItem(INVITATION_CONTEXT_KEY) ?? null
  } catch {
    return null
  }
  const context = parseInvitationContext(raw, now)
  if (raw !== null && context === null) clearInvitationContext()
  return context
}

/** Сохраняет контекст; `false`, если хранилище недоступно (контекст остаётся только в памяти). */
export function writeInvitationContext(context: InvitationContext): boolean {
  try {
    const target = storage()
    if (!target) return false
    target.setItem(
      INVITATION_CONTEXT_KEY,
      JSON.stringify({
        v: INVITATION_CONTEXT_VERSION,
        code: context.code,
        checkedAt: context.checkedAt,
      }),
    )
    return true
  } catch {
    return false
  }
}
