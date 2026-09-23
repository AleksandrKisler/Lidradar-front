/**
 * Единственный экземпляр HTTP-клиента приложения.
 * Все API-функции сущностей выполняют запросы только через него.
 */
import { env } from '@/shared/config'
import { createApiClient } from './create-client'

export const apiClient = createApiClient({ baseUrl: env.VITE_API_ORIGIN })
