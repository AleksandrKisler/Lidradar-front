/** Pending business commands only. Never use this journal for credentials or tokens.
 * Records are scoped to actor + tenant + operation + resource, removed on a
 * definitive result, and never silently discarded when unreadable/unavailable.
 */
import { ApiError } from './api-error'
import type { IdempotentDraft } from './idempotency'

const prefix = 'lidradar.pending-command.v1:'

/** Presence only: lets a closed workspace offer recovery without opening new commands. */
export function hasPendingCommand(scope: string): boolean {
  try {
    return localStorage.getItem(prefix + scope) !== null
  } catch {
    return true
  }
}

function unavailable(): ApiError {
  return new ApiError({ httpStatus: 0, code: 'PENDING_COMMAND_UNAVAILABLE' })
}

export function readPendingCommand<Body>(scope: string): IdempotentDraft<Body> | null {
  try {
    const raw = localStorage.getItem(prefix + scope)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (
      !value ||
      typeof value !== 'object' ||
      !('key' in value) ||
      typeof value.key !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(value.key) ||
      !('body' in value) ||
      !value.body ||
      typeof value.body !== 'object' ||
      !('state' in value) ||
      !['submitting', 'unknown', 'conflict'].includes(String(value.state))
    ) {
      throw unavailable()
    }
    return {
      key: value.key,
      body: value.body as Body,
      state: value.state === 'conflict' ? 'conflict' : 'unknown',
    }
  } catch {
    throw unavailable()
  }
}

export function writePendingCommand<Body>(scope: string, draft: IdempotentDraft<Body>): void {
  try {
    localStorage.setItem(prefix + scope, JSON.stringify(draft))
  } catch {
    throw unavailable()
  }
}

export function clearPendingCommand(scope: string): void {
  try {
    localStorage.removeItem(prefix + scope)
  } catch {
    throw unavailable()
  }
}
