/**
 * Поток личной привязки Telegram.
 *
 * Одноразовая ссылка выпускается по запросу, живёт 15 минут и хранится только
 * в памяти этого composable. После выпуска статус проверяется ограниченно:
 * пока вкладка видима, до истечения ссылки и не более заданного числа
 * попыток; ручная проверка доступна всегда. Отключение не трогает
 * подключение источника переписки — это другой ресурс и другой запрос.
 */
import { computed, onScopeDispose, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { organizationKeys } from '@/entities/organization'
import {
  disableTelegramLink,
  fetchTelegramLinkStatus,
  issueTelegramLinkToken,
  notificationKeys,
  type TelegramLinkToken,
} from '@/entities/notification'

export interface TelegramLinkOptions {
  /** Интервал автопроверки, мс. */
  pollIntervalMs?: number
  /** Предел автопроверок на одну ссылку. */
  maxPolls?: number
  /** Видимость вкладки; в тестах подменяется. */
  isVisible?: () => boolean
  now?: () => number
}

const MAX_TIMEOUT_MS = 2_147_483_647

export function useTelegramLink(
  tenantId: MaybeRefOrGetter<string>,
  options: TelegramLinkOptions = {},
) {
  const queryClient = useQueryClient()
  const pollInterval = options.pollIntervalMs ?? 5000
  const maxPolls = options.maxPolls ?? 24
  const isVisible =
    options.isVisible ??
    (() => typeof document === 'undefined' || document.visibilityState === 'visible')
  const now = options.now ?? (() => Date.now())
  const tenant = () => toValue(tenantId)

  const token = shallowRef<TelegramLinkToken | null>(null)
  const expired = ref(false)
  const polls = ref(0)
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null

  function stopPolling(): void {
    if (pollTimer !== null) clearTimeout(pollTimer)
    pollTimer = null
  }

  function clearTimers(): void {
    stopPolling()
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    expiryTimer = null
  }

  async function refreshStatus(): Promise<boolean> {
    const status = await fetchTelegramLinkStatus(tenant())
    queryClient.setQueryData(notificationKeys.link(tenant()), status)
    return status.linked
  }

  /** Привязка подтверждена: ссылка больше не нужна, шаг онбординга перечитывается. */
  async function markLinked(): Promise<void> {
    token.value = null
    clearTimers()
    await queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenant()) })
  }

  function schedulePoll(): void {
    stopPolling()
    if (!token.value || expired.value || polls.value >= maxPolls) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      void poll()
    }, pollInterval)
  }

  async function poll(): Promise<void> {
    if (!token.value || expired.value) return
    // Скрытая вкладка не опрашивает сервер: попытка переносится, а не сгорает.
    if (!isVisible()) {
      schedulePoll()
      return
    }
    polls.value += 1
    const linked = await refreshStatus().catch(() => false)
    if (linked) {
      await markLinked()
      return
    }
    schedulePoll()
  }

  function scheduleExpiry(expiresAt: string): void {
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    const delay = Math.max(0, new Date(expiresAt).getTime() - now())
    expiryTimer = setTimeout(
      () => {
        expiryTimer = null
        expired.value = true
        stopPolling()
      },
      Math.min(delay, MAX_TIMEOUT_MS),
    )
  }

  const issue = useMutation({
    mutationFn: () => issueTelegramLinkToken(tenant()),
    onMutate: () => {
      check.reset()
      disable.reset()
    },
    onSuccess: (issued) => {
      token.value = issued
      expired.value = false
      polls.value = 0
      scheduleExpiry(issued.expiresAt)
      schedulePoll()
    },
  })

  /** Ручная проверка не расходует автоматические попытки. */
  const check = useMutation({
    mutationFn: () => refreshStatus(),
    onMutate: () => {
      issue.reset()
      disable.reset()
    },
    onSuccess: async (linked) => {
      if (linked) await markLinked()
    },
  })

  const disable = useMutation({
    mutationFn: () => disableTelegramLink(tenant()),
    onMutate: () => {
      issue.reset()
      check.reset()
    },
    onSuccess: async () => {
      token.value = null
      expired.value = false
      clearTimers()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationKeys.link(tenant()) }),
        queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenant()) }),
      ])
    },
  })

  onScopeDispose(() => {
    clearTimers()
    token.value = null
  })

  return {
    token,
    expired,
    polls,
    /** Автопроверки исчерпаны: остаётся ручная кнопка или новая ссылка. */
    pollsExhausted: computed(() => polls.value >= maxPolls),
    issue,
    check,
    disable,
  }
}
