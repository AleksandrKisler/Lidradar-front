/**
 * Типы песочницы переписки закрытого стейджа (ADR 0066) берутся из контракта OpenAPI. Ручных DTO нет.
 */
import type { Schema } from '@/shared/api'

export type SandboxConversation = Schema<'SandboxConversation'>
export type SandboxMessage = Schema<'SandboxMessage'>
export type SandboxVerdict = Schema<'SandboxVerdict'>
export type SandboxFoundRisk = Schema<'SandboxFoundRisk'>
export type SandboxTemplate = Schema<'SandboxTemplate'>
export type SandboxOverview = Schema<'SandboxOverview'>
export type SandboxDirection = Schema<'SandboxDirection'>
export type SandboxCreateRequest = Schema<'SandboxCreateRequest'>
export type SandboxSendRequest = Schema<'SandboxSendRequest'>
export type VerdictState = SandboxVerdict['state']
export type VerdictStage = NonNullable<SandboxVerdict['stage']>

/** Пока сверка в состоянии PROCESSING, переписка перечитывается раз в 3 секунды (ADR 0066 п. 7). */
export const SANDBOX_POLL_INTERVAL_MS = 3000
