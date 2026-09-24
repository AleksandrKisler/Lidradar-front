/**
 * Read-модели администратора платформы (ADR 0040). Не привязаны к
 * организации: ключи кеша начинаются с `admin`, заголовок `X-Tenant-ID` не
 * отправляется. Контракт намеренно не содержит текстов сообщений, промптов
 * и сырого вывода модели — интерфейс показывает только метаданные.
 */
import type { Schema } from '@/shared/api'

export type PlatformAdmin = Schema<'PlatformAdmin'>
export type AdminOrganization = Schema<'AdminOrganization'>
export type AdminConnection = Schema<'AdminConnection'>
export type AdminQueueStats = Schema<'AdminQueueStats'>
export type AdminLifecycleCounts = Schema<'AdminLifecycleCounts'>
export type AdminJob = Schema<'AdminJob'>
export type AdminOutboxEvent = Schema<'AdminOutboxEvent'>
export type AdminAIJob = Schema<'AdminAIJob'>
export type AdminDelivery = Schema<'AdminDelivery'>
export type AdminDeadLetters = Schema<'AdminDeadLetters'>
export type AdminAINode = Schema<'AdminAINode'>
export type AdminAIRun = Schema<'AdminAIRun'>
export type AdminSemanticFact = Schema<'AdminSemanticFact'>
export type AdminConversationSummary = Schema<'AdminConversationSummary'>
export type AdminTenantUsage = Schema<'AdminTenantUsage'>
export type AdminUsageReport = Schema<'AdminUsageReport'>
export type AdminTrace = Schema<'AdminTrace'>

export interface AdminMe {
  userId: string
  platformAdmin: boolean
}

export type JobStatus = AdminJob['status']
export type AIRunStatus = AdminAIRun['status']
export type AIApplicationStatus = AdminAIRun['applicationStatus']

export const JOB_STATUSES: readonly JobStatus[] = [
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SUCCEEDED',
  'DEAD',
]
export const AI_RUN_STATUSES: readonly AIRunStatus[] = ['RUNNING', 'SUCCEEDED', 'FAILED']
export const AI_APPLICATION_STATUSES: readonly AIApplicationStatus[] = [
  'PENDING',
  'APPLIED',
  'STALE',
  'REJECTED',
]

/** Списки ограничены лимитом контракта (1..200); курсоров у admin API нет. */
export const ADMIN_LIMITS = [50, 100, 200] as const
export const DEFAULT_ADMIN_LIMIT = 50

export interface JobFilters {
  tenantId?: string | undefined
  status?: JobStatus | undefined
  type?: string | undefined
  limit?: number | undefined
}

export interface AIRunFilters {
  tenantId?: string | undefined
  status?: AIRunStatus | undefined
  applicationStatus?: AIApplicationStatus | undefined
  limit?: number | undefined
}

/** Объекты, над которыми есть команды восстановления. */
export type DeadLetterKind = 'job' | 'outbox' | 'aiJob' | 'delivery'
export type RecoveryAction = 'retry' | 'replay' | 'discard'
