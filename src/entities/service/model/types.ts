/** Типы каталога услуг из контракта OpenAPI. */
import type { Schema } from '@/shared/api'

export type ServiceCatalogItem = Schema<'ServiceCatalogItem'>
export type CreateServiceCatalogItemRequest = Schema<'CreateServiceCatalogItemRequest'>
export type UpdateServiceCatalogItemRequest = Schema<'UpdateServiceCatalogItemRequest'>

/** Unicode code points after whitespace cleanup, as in the API and PostgreSQL. */
export const SERVICE_NAME_MAX_LENGTH = 200
