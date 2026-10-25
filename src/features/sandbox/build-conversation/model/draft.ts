/**
 * Черновик переписки песочницы (ADR 0066 п. 4): живёт только в браузере, с ключом пользователя и организации,
 * до нажатия «Отправить в систему» сервер о нём не знает. Хранилище может быть недоступно (приватное окно,
 * запрет сайта) — тогда черновик живёт до перезагрузки страницы.
 */
import type {
  DraftMessage,
  SandboxCreateRequest,
  SandboxDirection,
  SandboxTemplate,
} from '@/entities/sandbox'

export interface SandboxDraft {
  templateCode: string
  locationId: string
  contactName: string
  messages: DraftMessage[]
  tailMinutes: number
  /** Пауза перед следующим добавляемым сообщением. */
  nextPause: number
}

const STORAGE_PREFIX = 'lidradar.sandbox.draft:'

export function draftStorageKey(userId: string, tenantId: string): string {
  return `${STORAGE_PREFIX}${userId}:${tenantId}`
}

/** Черновик из шаблона: тексты можно поправить, ожидание шаблона сохраняется. */
export function draftFromTemplate(template: SandboxTemplate, locationId: string): SandboxDraft {
  return {
    templateCode: template.code,
    locationId,
    contactName: '',
    messages: template.messages.map((message) => ({ ...message })),
    tailMinutes: template.tailMinutes,
    nextPause: 0,
  }
}

/** Добавляет сообщение в конец; пауза берётся из `nextPause` и сбрасывается. */
export function addDraftMessage(
  draft: SandboxDraft,
  direction: SandboxDirection,
  text: string,
): SandboxDraft {
  const message: DraftMessage = {
    direction,
    text: text.trim(),
    pauseBeforeMinutes: draft.messages.length === 0 ? 0 : draft.nextPause,
  }
  return { ...draft, messages: [...draft.messages, message], nextPause: 0 }
}

export function removeDraftMessage(draft: SandboxDraft, index: number): SandboxDraft {
  const messages = draft.messages.filter((_, position) => position !== index)
  if (messages[0]) messages[0] = { ...messages[0], pauseBeforeMinutes: 0 }
  return { ...draft, messages }
}

/** Меняет только текст сообщения черновика; отправленные сообщения неизменяемы. */
export function editDraftMessage(draft: SandboxDraft, index: number, text: string): SandboxDraft {
  if (index < 0 || index >= draft.messages.length) return draft
  return {
    ...draft,
    messages: draft.messages.map((message, position) =>
      position === index ? { ...message, text } : message,
    ),
  }
}

/** Сравнение с исходными текстами шаблона для подсказки до отправки. */
export function hasModifiedTemplate(
  draft: SandboxDraft,
  template: SandboxTemplate | null,
): boolean {
  if (!template || template.code === 'empty' || draft.templateCode !== template.code) return false
  return (
    draft.messages.length !== template.messages.length ||
    draft.messages.some((message, index) => message.text !== template.messages[index]?.text)
  )
}

/** Тело команды сборки: пустое имя клиента не отправляется — сервер выберет синтетическое. */
export function toCreateRequest(draft: SandboxDraft): SandboxCreateRequest {
  const contactName = draft.contactName.trim()
  return {
    locationId: draft.locationId,
    templateCode: draft.templateCode as SandboxCreateRequest['templateCode'],
    tailMinutes: draft.tailMinutes,
    messages: draft.messages.map((message, index) => ({
      direction: message.direction,
      text: message.text.trim(),
      pauseBeforeMinutes: index === 0 ? 0 : message.pauseBeforeMinutes,
    })),
    ...(contactName ? { contactName } : {}),
  }
}

function isDirection(value: unknown): value is SandboxDirection {
  return value === 'INCOMING' || value === 'OUTGOING'
}

function isDraft(value: unknown): value is SandboxDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.templateCode === 'string' &&
    typeof draft.locationId === 'string' &&
    typeof draft.contactName === 'string' &&
    typeof draft.tailMinutes === 'number' &&
    typeof draft.nextPause === 'number' &&
    Array.isArray(draft.messages) &&
    draft.messages.every(
      (message: unknown) =>
        typeof message === 'object' &&
        message !== null &&
        isDirection((message as DraftMessage).direction) &&
        typeof (message as DraftMessage).text === 'string' &&
        typeof (message as DraftMessage).pauseBeforeMinutes === 'number',
    )
  )
}

export function readDraft(storage: Storage | null, key: string): SandboxDraft | null {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeDraft(storage: Storage | null, key: string, draft: SandboxDraft | null): void {
  try {
    if (draft) storage?.setItem(key, JSON.stringify(draft))
    else storage?.removeItem(key)
  } catch {
    // Хранилище недоступно: черновик живёт в памяти до перезагрузки.
  }
}

/** Доступ к localStorage без исключений. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
