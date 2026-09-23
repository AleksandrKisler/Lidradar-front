/**
 * Настройка TanStack Query: единственного владельца серверного состояния.
 *
 * Чтения повторяются только при сетевом сбое или `5xx`, мутации — никогда
 * (идемпотентные команды повторяет пользователь с тем же ключом). Данные
 * считаются свежими полминуты и перечитываются при возврате на вкладку.
 */
import { QueryClient } from '@tanstack/vue-query'
import { shouldRetryRead } from '@/shared/api'

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRead,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  })
}
