/**
 * Хранилище сессии: пользователь, членства и выбранная организация.
 *
 * Здесь нет данных API кроме ответа `/auth/me`: риски, переписки и прочее
 * живут в TanStack Query. Хранилище не знает о маршрутизаторе и кеше
 * запросов — реакцию на смену состояния (переход на вход, очистку кеша)
 * выполняют слои `app` и `features`.
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isApiError } from '@/shared/api'
import { fetchMe, logout as logoutRequest } from '../api/auth-api'
import { permissionsForRole, type Permission } from './permissions'
import {
  forgetPreferredTenant,
  readPreferredTenant,
  rememberPreferredTenant,
} from './tenant-preference'
import type { AuthMeResponse, MembershipSummary, SessionStatus, SignOutReason, User } from './types'

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('idle')
  /** Первичная загрузка завершилась (успехом, гостем или ошибкой). */
  const booted = ref(false)
  const user = ref<User | null>(null)
  const memberships = ref<MembershipSummary[]>([])
  const tenantId = ref<string | null>(null)
  /** Ошибка загрузки `/auth/me`, если это не отсутствие сессии. */
  const bootError = ref<unknown>(null)
  /** Причина выхода — подсказка экрану входа; сбрасывается при следующем входе. */
  const signOutReason = ref<SignOutReason | null>(null)

  let inflight: Promise<void> | null = null

  const isAuthenticated = computed(() => status.value === 'authenticated')
  /** Членство в выбранной организации либо `null`, если выбор не сделан. */
  const membership = computed(
    () => memberships.value.find((item) => item.tenantId === tenantId.value) ?? null,
  )
  const role = computed(() => membership.value?.role ?? null)
  const permissions = computed(() => permissionsForRole(role.value))
  const hasTenant = computed(() => membership.value !== null)

  /** Есть ли у текущей роли право; без выбранной организации всегда `false`. */
  function can(permission: Permission): boolean {
    return permissions.value.has(permission)
  }

  /**
   * Применяет ответ `/auth/me` и выбирает организацию: сохраняет текущий
   * выбор, если он ещё действителен; единственное членство выбирает
   * автоматически; иначе восстанавливает проверенный запомненный выбор.
   */
  function applyIdentity(me: AuthMeResponse): void {
    user.value = me.user
    memberships.value = me.memberships
    const isValid = (id: string | null): id is string =>
      id !== null && me.memberships.some((item) => item.tenantId === id)
    const stored = readPreferredTenant(me.user.id)
    if (stored && !isValid(stored)) forgetPreferredTenant(me.user.id)
    let next: string | null = null
    if (isValid(tenantId.value)) next = tenantId.value
    else if (me.memberships.length === 1) next = me.memberships[0]!.tenantId
    else if (isValid(stored)) next = stored
    tenantId.value = next
    if (next) rememberPreferredTenant(me.user.id, next)
    status.value = 'authenticated'
    bootError.value = null
    signOutReason.value = null
  }

  function becomeGuest(reason: SignOutReason | null): void {
    user.value = null
    memberships.value = []
    tenantId.value = null
    status.value = 'guest'
    bootError.value = null
    signOutReason.value = reason
  }

  /**
   * Загружает `/auth/me`. Отсутствие сессии (`401`) — штатное состояние
   * гостя; любая другая ошибка пробрасывается вызывающему.
   */
  async function load(): Promise<void> {
    try {
      applyIdentity(await fetchMe())
    } catch (error) {
      if (isApiError(error) && error.isUnauthenticated) {
        becomeGuest(null)
        return
      }
      throw error
    }
  }

  /**
   * Первичная загрузка при старте приложения. Повторные вызовы во время
   * загрузки возвращают тот же промис; после ошибки вызов повторяет запрос.
   * Не бросает исключений: результат виден в `status` и `bootError`.
   */
  function bootstrap(): Promise<void> {
    if (status.value === 'authenticated' || status.value === 'guest') return Promise.resolve()
    if (!inflight) {
      status.value = 'loading'
      inflight = load()
        .catch((error: unknown) => {
          bootError.value = error
          status.value = 'error'
        })
        .finally(() => {
          booted.value = true
          inflight = null
        })
    }
    return inflight
  }

  /**
   * Перечитывает `/auth/me` после входа, регистрации или создания
   * организации. Ошибки пробрасываются: форма покажет их пользователю.
   */
  async function refresh(): Promise<void> {
    await load()
  }

  /** Выбирает организацию из списка членств; чужой идентификатор отклоняется. */
  function selectTenant(id: string): boolean {
    if (!user.value || !memberships.value.some((item) => item.tenantId === id)) return false
    tenantId.value = id
    rememberPreferredTenant(user.value.id, id)
    return true
  }

  /** Снимает выбор организации, не трогая запомненное предпочтение. */
  function clearTenant(): void {
    tenantId.value = null
  }

  /** Сервер сообщил, что сессии больше нет (401 на защищённом пути). */
  function markExpired(): void {
    becomeGuest('expired')
  }

  /**
   * Выход. Локальное состояние очищается в любом случае, включая
   * запомненную организацию; `confirmed=false` означает, что сервер не
   * подтвердил отзыв сессии (сеть) и интерфейс должен об этом сказать.
   */
  async function logout(): Promise<{ confirmed: boolean }> {
    const userId = user.value?.id
    let confirmed = true
    try {
      await logoutRequest()
    } catch {
      confirmed = false
    } finally {
      if (userId) forgetPreferredTenant(userId)
      becomeGuest('manual')
    }
    return { confirmed }
  }

  return {
    status,
    booted,
    user,
    memberships,
    tenantId,
    bootError,
    signOutReason,
    isAuthenticated,
    membership,
    role,
    permissions,
    hasTenant,
    can,
    bootstrap,
    refresh,
    selectTenant,
    clearTenant,
    markExpired,
    logout,
  }
})

export type SessionStore = ReturnType<typeof useSessionStore>
