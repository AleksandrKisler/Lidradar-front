import { apiClient, unwrap, type Schema } from '@/shared/api'

export type Conversation = Schema<'SandboxConversation'>
export type Draft = Schema<'SandboxCreateRequest'>
export type Send = Schema<'SandboxSendRequest'>
export type Template = Schema<'SandboxTemplate'>
export type Overview = Schema<'SandboxOverview'>
const headers = (tenantId: string) => ({ 'X-Tenant-ID': tenantId })

export const sandboxApi = {
  overview: (tenantId: string, signal?: AbortSignal) =>
    unwrap(
      apiClient.GET('/api/v1/sandbox', {
        params: { header: headers(tenantId) },
        signal: signal ?? null,
      }),
    ),
  templates: (tenantId: string, signal?: AbortSignal) =>
    unwrap(
      apiClient.GET('/api/v1/sandbox/templates', {
        params: { header: headers(tenantId) },
        signal: signal ?? null,
      }),
    ),
  list: (tenantId: string, signal?: AbortSignal) =>
    unwrap(
      apiClient.GET('/api/v1/sandbox/conversations', {
        params: { header: headers(tenantId) },
        ...(signal ? { signal: signal ?? null } : {}),
      }),
    ),
  detail: (tenantId: string, conversationId: string, signal?: AbortSignal) =>
    unwrap(
      apiClient.GET('/api/v1/sandbox/conversations/{conversationId}', {
        params: { header: headers(tenantId), path: { conversationId } },
        signal: signal ?? null,
      }),
    ),
  create: (tenantId: string, body: Draft, key: string) =>
    unwrap(
      apiClient.POST('/api/v1/sandbox/conversations', {
        params: { header: { ...headers(tenantId), 'Idempotency-Key': key } },
        body,
      }),
    ),
  send: (tenantId: string, conversationId: string, body: Send, key: string) =>
    unwrap(
      apiClient.POST('/api/v1/sandbox/conversations/{conversationId}/messages', {
        params: {
          header: { ...headers(tenantId), 'Idempotency-Key': key },
          path: { conversationId },
        },
        body,
      }),
    ),
}
