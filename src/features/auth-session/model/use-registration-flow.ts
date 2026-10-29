/**
 * Модель страницы регистрации US-M01-01: сценарии A (открытая), B2/B3 (по приглашению) и C
 * (общая регистрация закрыта) на одном маршруте `/register`.
 *
 * - Обычный `/register` выбирает A или C только по ответу режима, полученному при **этом** входе;
 *   прежний кеш `open` форму не открывает. Сбой — служебная ошибка с ручным повтором.
 * - `flow=invite` (или ссылка с `code`) — шаг кода B2, не зависящий от режима. Проверка — одна
 *   команда для автоматического (400 мс после полного корректного кода), ручного (Enter/стрелка),
 *   ссылочного и восстановительного запуска; одновременно не больше одного запроса. Смена шага,
 *   адреса или уход со страницы отменяют таймер и запрос, поздний ответ отсекается поколением.
 * - Контекст проверенного кода живёт в памяти и в `sessionStorage` вкладки (`invitation-context`);
 *   после перезагрузки он сначала перепроверяется сервером. Имя и почта — только в памяти
 *   страницы, пароль — только в текущей форме.
 * - Отправка различает подтверждённый отказ, созданный аккаунт с загрузкой сессии, сбой загрузки
 *   сессии и неизвестный исход. Регистрация автоматически не повторяется никогда.
 */
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import { useRetryAfter } from '@/shared/lib'
import { INVITATION_CODE_LENGTH } from '@/entities/team'
import {
  checkRegistrationInvitation,
  register,
  useRegistrationModeQuery,
  useSessionStore,
} from '@/entities/session'
import {
  clearInvitationContext,
  isInvitationContextFresh,
  readInvitationContext,
  writeInvitationContext,
  INVITATION_CONTEXT_TTL_MS,
  type InvitationContext,
} from './invitation-context'
import { classifyInvitationCheckError, classifyRegisterError } from './registration-errors'
import { checkInvitationCodeFormat } from './schemas'

/** Задержка автоматической проверки после ввода полного корректного кода. */
export const AUTO_CHECK_DELAY_MS = 400
/** Ключ ожидания после `429` проверки кода; отдельный от регистрации и входа. */
export const INVITATION_CHECK_RETRY_KEY = 'lidradar.invitation-check.retryUntil'
/** Ключ ожидания после `429` регистрации (прежний, общий с формой до US-M01-01). */
export const REGISTER_RETRY_KEY = 'lidradar.register.retryUntil'
/** Длина значения из ссылки, которая попадает в поле; остальное всё равно неверного формата. */
const LINK_CODE_DISPLAY_LIMIT = 128

export type RegistrationView =
  /** Режим ещё не получен при этом входе: каркас A/C. */
  | 'mode-loading'
  /** Режим получить не удалось: служебная ошибка и ручной повтор. */
  | 'mode-error'
  /** A: открытая регистрация. */
  | 'open'
  /** C: общая регистрация закрыта. */
  | 'closed'
  /** B2: ввод и проверка кода. */
  | 'invite-code'
  /** Восстановленный контекст перепроверяется до B3: каркас B3. */
  | 'invite-restoring'
  /** B3: данные аккаунта после проверенного приглашения. */
  | 'invite-details'

export type InvitationCodeStatus =
  'idle' | 'empty' | 'format' | 'checking' | 'invalid' | 'service' | 'rate-limited'

export type RegistrationSubmitStatus =
  | 'idle'
  | 'submitting'
  /** Подтверждённый нейтральный отказ: данные и контекст сохранены. */
  | 'rejected'
  /** Прочий определённый отказ: безопасная подпись ошибки. */
  | 'failed'
  /** `201` получен и зафиксирован; загружается сессия. */
  | 'account-created'
  /** Аккаунт создан, сессию загрузить не удалось: повторяется только `/auth/me`. */
  | 'session-error'
  /** Ответ регистрации потерян: сверка с `/auth/me`. */
  | 'reconciling'
  /** Исход не установлен: переход к входу или восстановлению, без новой отправки. */
  | 'outcome-unknown'

export interface RegistrationValues {
  displayName: string
  email: string
  password: string
}

const BUSY_SUBMIT: ReadonlySet<RegistrationSubmitStatus> = new Set([
  'submitting',
  'account-created',
  'reconciling',
])
const LOCKED_SUBMIT: ReadonlySet<RegistrationSubmitStatus> = new Set([
  'session-error',
  'outcome-unknown',
])
const CODE_ALPHABET = /^[A-Za-z0-9_-]*$/

/** `flow=invite` или любая ссылка с `code` выбирают сценарий B; остальное — обычный вход A/C. */
export function isInviteQuery(query: LocationQuery): boolean {
  return query.flow === 'invite' || query.code !== undefined
}

export type LinkCode =
  { present: false } | { present: true; value: string; problem: 'empty' | 'format' | null }

/** Код из персональной ссылки. Пустой или повторённый параметр — ошибка шага B2, а не A. */
export function readLinkCode(query: LocationQuery): LinkCode {
  const raw = query.code
  if (raw === undefined) return { present: false }
  if (Array.isArray(raw)) return { present: true, value: '', problem: 'format' }
  if (raw === null) return { present: true, value: '', problem: 'empty' }
  return { present: true, value: raw, problem: checkInvitationCodeFormat(raw).problem }
}

/** Прочие параметры адреса сохраняются; `code` убирается, `flow=invite` остаётся. */
export function inviteQuery(query: LocationQuery): LocationQueryRaw {
  const rest: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'code' && key !== 'flow') rest[key] = value
  }
  return { ...rest, flow: 'invite' }
}

export function useRegistrationFlow() {
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()

  let disposed = false
  const flow = ref<'ordinary' | 'invite'>(isInviteQuery(route.query) ? 'invite' : 'ordinary')

  /** Имя и почта переживают переход между шагами страницы, но только в памяти. */
  const draft = reactive({ displayName: '', email: '' })
  const submitStatus = ref<RegistrationSubmitStatus>('idle')
  const submitError = shallowRef<unknown>(null)
  const registerRetry = useRetryAfter(REGISTER_RETRY_KEY)
  const submitBusy = computed(() => BUSY_SUBMIT.has(submitStatus.value))
  const submitLocked = computed(() => LOCKED_SUBMIT.has(submitStatus.value))

  /* ---------- Режим A/C ---------- */

  const modeQuery = useRegistrationModeQuery({ enabled: () => flow.value === 'ordinary' })
  const modeState = ref<'loading' | 'open' | 'invite_only' | 'error'>('loading')
  const modeError = shallowRef<unknown>(null)
  /** Сервер отказал в регистрации без кода: закрытое состояние до нового входа на страницу. */
  const serverRequiresInvite = ref(false)
  let modeGeneration = 0

  /**
   * Режим для текущего входа: решение принимается только по результату запроса, начатого или
   * присоединённого сейчас. `fresh` прерывает идущий запрос и начинает новый.
   */
  async function loadMode(fresh: boolean): Promise<void> {
    const generation = ++modeGeneration
    modeState.value = 'loading'
    modeError.value = null
    const result = await modeQuery.refetch({ cancelRefetch: fresh })
    if (generation !== modeGeneration || disposed) return
    if (result.status === 'success' && result.data) {
      modeState.value = result.data.mode
    } else {
      modeState.value = 'error'
      modeError.value = result.error
    }
  }

  /* ---------- Приглашение B2/B3 ---------- */

  const code = ref('')
  const codeStatus = ref<InvitationCodeStatus>('idle')
  const step = ref<'code' | 'restoring' | 'details'>('code')
  const invitation = shallowRef<InvitationContext | null>(null)
  /** B3 открыт успешной проверкой (а не восстановлением): форма данных получает фокус. */
  const openedByCheck = ref(false)
  const checkRetry = useRetryAfter(INVITATION_CHECK_RETRY_KEY)

  let inviteGeneration = 0
  let inflight = false
  let composing = false
  let controller: AbortController | null = null
  let autoTimer: ReturnType<typeof setTimeout> | null = null
  let expiryTimer: ReturnType<typeof setTimeout> | null = null

  function cancelAutoCheck(): void {
    if (autoTimer !== null) clearTimeout(autoTimer)
    autoTimer = null
  }

  /** Отменяет таймер и запрос проверки; ответ прежнего поколения больше ничего не изменит. */
  function cancelInvitationWork(): void {
    inviteGeneration++
    cancelAutoCheck()
    controller?.abort()
    controller = null
    inflight = false
    composing = false
  }

  /** Контекст в памяти; запись вкладки удаляется отдельно. */
  function forgetInvitationInMemory(): void {
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    expiryTimer = null
    invitation.value = null
  }

  function clearInvitation(): void {
    forgetInvitationInMemory()
    clearInvitationContext()
  }

  function idleStatus(): InvitationCodeStatus {
    return checkRetry.active.value ? 'rate-limited' : 'idle'
  }

  /** Пустой шаг кода без прежнего подтверждения. Запись вкладки не трогает. */
  function showEmptyCode(): void {
    cancelInvitationWork()
    forgetInvitationInMemory()
    step.value = 'code'
    openedByCheck.value = false
    code.value = ''
    codeStatus.value = idleStatus()
  }

  /** Пустой B2: прежнее подтверждение сброшено везде. */
  function resetToEmptyCode(): void {
    showEmptyCode()
    clearInvitationContext()
  }

  function scheduleExpiry(context: InvitationContext): void {
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    const left = context.checkedAt + INVITATION_CONTEXT_TTL_MS - Date.now()
    expiryTimer = setTimeout(onInvitationExpired, Math.max(0, left))
  }

  /** Клиентский срок истёк: контекст очищается; во время отправки решает сервер. */
  function onInvitationExpired(): void {
    expiryTimer = null
    if (submitBusy.value) return
    if (submitLocked.value) {
      clearInvitation()
      return
    }
    if (step.value === 'details') {
      resetToEmptyCode()
      submitStatus.value = 'idle'
      submitError.value = null
    } else clearInvitation()
  }

  watch(submitBusy, (busy) => {
    if (
      busy ||
      !invitation.value ||
      isInvitationContextFresh(invitation.value.checkedAt, Date.now())
    )
      return
    // Таймер мог истечь, пока сервер решал исход регистрации. После ответа
    // просроченный proof удаляется сразу. Неизвестный исход остаётся заблокированным.
    if (submitLocked.value) clearInvitation()
    else onInvitationExpired()
  })

  function failCheck(status: InvitationCodeStatus): void {
    step.value = 'code'
    codeStatus.value = status
  }

  /**
   * Единая команда проверки. `restoredCheckedAt` — время первой проверки восстановленного
   * контекста: перепроверка срок не продлевает.
   */
  async function runCheck(
    origin: 'auto' | 'manual' | 'link' | 'restore',
    restoredCheckedAt?: number,
  ): Promise<void> {
    if (inflight) return
    if (checkRetry.active.value) {
      failCheck('rate-limited')
      return
    }
    const { code: normalized, problem } = checkInvitationCodeFormat(code.value)
    if (problem !== null) {
      if (origin !== 'auto') failCheck(problem)
      return
    }
    cancelAutoCheck()
    // Восстановление могло завершиться служебным сбоем. Последующий ручной
    // повтор того же кода сохраняет время первой проверки, в том числе при 429.
    const previousContext = invitation.value ?? readInvitationContext()
    const generation = inviteGeneration
    const current = new AbortController()
    controller = current
    inflight = true
    codeStatus.value = 'checking'
    try {
      await checkRegistrationInvitation(normalized, current.signal)
    } catch (error) {
      if (generation !== inviteGeneration) return
      inflight = false
      controller = null
      const failure = classifyInvitationCheckError(error)
      if (failure.kind === 'rate-limited') {
        checkRetry.start(failure.seconds)
        failCheck('rate-limited')
        return
      }
      // Отказ кода: сохранённый контекст больше не нужен; сбой сервиса его не трогает.
      if (failure.kind === 'invalid') clearInvitation()
      failCheck(failure.kind)
      return
    }
    if (generation !== inviteGeneration) return
    inflight = false
    controller = null
    const now = Date.now()
    const checkedAt =
      restoredCheckedAt ?? (previousContext?.code === normalized ? previousContext.checkedAt : now)
    if (!isInvitationContextFresh(checkedAt, now)) {
      // Срок восстановленного контекста истёк, пока шла проверка: код нужно ввести снова.
      resetToEmptyCode()
      return
    }
    const context: InvitationContext = { code: normalized, checkedAt }
    invitation.value = context
    writeInvitationContext(context)
    scheduleExpiry(context)
    codeStatus.value = 'idle'
    openedByCheck.value = origin !== 'restore'
    step.value = 'details'
  }

  /** Ввод в поле кода. Во время IME-набора ничего не проверяется. */
  function inputCode(value: string, isComposing = false): void {
    if (codeStatus.value === 'checking') return
    code.value = value
    composing = isComposing
    cancelAutoCheck()
    if (codeStatus.value !== 'rate-limited') codeStatus.value = 'idle'
    if (isComposing) return
    const { code: normalized, problem } = checkInvitationCodeFormat(value)
    if (problem === null) {
      if (checkRetry.active.value) return
      autoTimer = setTimeout(() => {
        autoTimer = null
        void runCheck('auto')
      }, AUTO_CHECK_DELAY_MS)
      return
    }
    // Заведомо неверное значение (лишняя длина, недопустимый знак) объясняется сразу, без запроса;
    // неполный код ждёт продолжения ввода или ручной проверки.
    if (
      problem === 'format' &&
      codeStatus.value !== 'rate-limited' &&
      (normalized.length > INVITATION_CODE_LENGTH || !CODE_ALPHABET.test(normalized))
    ) {
      codeStatus.value = 'format'
    }
  }

  /** Enter или стрелка: отменяет ожидающую автопроверку и проверяет сразу. */
  function submitCode(): void {
    cancelAutoCheck()
    if (composing) return
    void runCheck('manual')
  }

  watch(checkRetry.active, (active) => {
    // Срок ожидания прошёл: снова доступна ручная проверка, автоматического запроса нет.
    if (!active && codeStatus.value === 'rate-limited') codeStatus.value = 'idle'
  })

  /** B3 → B2: «Использовать другое приглашение». */
  function useOtherInvitation(): void {
    if (submitBusy.value || submitLocked.value) return
    resetToEmptyCode()
    submitStatus.value = 'idle'
    submitError.value = null
  }

  /* ---------- Вход на страницу и смена адреса ---------- */

  function enter(query: LocationQuery): void {
    // Back/Forward и query-only переходы сохраняют mounted flow. Не снимаем
    // защиту после 201 или неизвестного исхода, даже если URL выбрал другой шаг.
    if (submitBusy.value || submitLocked.value) {
      if (query.code !== undefined) {
        void router.replace({ name: 'register', query: inviteQuery(query), hash: route.hash })
      }
      return
    }
    submitStatus.value = 'idle'
    submitError.value = null
    if (!isInviteQuery(query)) {
      // Обычный A/C: приглашение не применяется незаметно, контекст очищается.
      resetToEmptyCode()
      serverRequiresInvite.value = false
      flow.value = 'ordinary'
      void loadMode(false)
      return
    }
    modeGeneration++
    flow.value = 'invite'
    const link = readLinkCode(query)
    if (link.present) {
      // Новая ссылка важнее сохранённого контекста; код убирается из адреса один раз.
      resetToEmptyCode()
      void router.replace({ name: 'register', query: inviteQuery(query), hash: route.hash })
      code.value = link.value.slice(0, LINK_CODE_DISPLAY_LIMIT)
      if (link.problem === null) void runCheck('link')
      else codeStatus.value = checkRetry.active.value ? 'rate-limited' : link.problem
      return
    }
    // Без ссылки сохранённый контекст вкладки сначала перепроверяется сервером, только потом B3.
    showEmptyCode()
    const restored = readInvitationContext()
    if (restored) {
      step.value = 'restoring'
      code.value = restored.code
      void runCheck('restore', restored.checkedAt)
    }
  }

  watch(
    () => route.query,
    (query) => {
      // Уход на другой маршрут обрабатывает размонтирование, а не смена сценария.
      if (route.name !== 'register' || disposed) return
      const nextFlow = isInviteQuery(query) ? 'invite' : 'ordinary'
      // Собственная очистка `code` и посторонние параметры не начинают сценарий заново.
      if (nextFlow === flow.value && query.code === undefined) return
      enter(query)
    },
  )

  /* ---------- Данные аккаунта и отправка ---------- */

  const view = computed<RegistrationView>(() => {
    if (flow.value === 'invite') {
      if (step.value === 'details') return 'invite-details'
      return step.value === 'restoring' ? 'invite-restoring' : 'invite-code'
    }
    if (modeState.value === 'loading') return 'mode-loading'
    if (modeState.value === 'error') return 'mode-error'
    if (serverRequiresInvite.value) return 'closed'
    return modeState.value === 'open' ? 'open' : 'closed'
  })

  async function finishWithSession(): Promise<void> {
    submitStatus.value = 'account-created'
    submitError.value = null
    try {
      await session.refresh()
    } catch (error) {
      if (disposed) return
      submitStatus.value = 'session-error'
      submitError.value = error
      return
    }
    if (disposed) return
    // Разрешённый промис ещё не вход: гостевой ответ `/auth/me` — не подтверждённая сессия.
    if (!session.isAuthenticated) {
      submitStatus.value = 'session-error'
      return
    }
    void router.replace({ name: 'radar' })
  }

  /** Сверка неизвестного исхода: только `/auth/me`, без повторной регистрации. */
  async function reconcile(): Promise<void> {
    submitStatus.value = 'reconciling'
    try {
      await session.refresh()
    } catch {
      if (!disposed) submitStatus.value = 'outcome-unknown'
      return
    }
    if (disposed) return
    if (session.isAuthenticated) {
      clearInvitation()
      void router.replace({ name: 'radar' })
      return
    }
    submitStatus.value = 'outcome-unknown'
  }

  function onRegisterError(error: unknown, inviteCode: string | undefined): void {
    const failure = classifyRegisterError(error)
    if (failure.kind === 'rejected') {
      submitError.value = error
      submitStatus.value = 'rejected'
      return
    }
    if (failure.kind === 'invitation-invalid' && inviteCode !== undefined) {
      // Окончательный отказ приглашения: B2 с видимым кодом и красным «!»; пароль не переносится.
      cancelInvitationWork()
      clearInvitation()
      submitStatus.value = 'idle'
      step.value = 'code'
      openedByCheck.value = false
      code.value = inviteCode
      codeStatus.value = 'invalid'
      return
    }
    if (failure.kind === 'invitation-required' && inviteCode === undefined) {
      // Режим закрылся до отправки: устаревший `open` больше не разрешает отправку без кода.
      submitStatus.value = 'idle'
      serverRequiresInvite.value = true
      void loadMode(true)
      return
    }
    if (failure.kind === 'unknown-outcome') {
      void reconcile()
      return
    }
    if (failure.kind === 'rate-limited') registerRetry.start(failure.seconds)
    submitStatus.value = 'failed'
    submitError.value = error
  }

  async function submit(values: RegistrationValues): Promise<void> {
    if (submitBusy.value || submitLocked.value || registerRetry.active.value) return
    let inviteCode: string | undefined
    if (view.value === 'invite-details') {
      const context = invitation.value
      if (!context || !isInvitationContextFresh(context.checkedAt, Date.now())) {
        onInvitationExpired()
        return
      }
      inviteCode = context.code
    } else if (view.value !== 'open') {
      return
    }
    submitStatus.value = 'submitting'
    submitError.value = null
    try {
      await register({
        email: values.email,
        displayName: values.displayName,
        password: values.password,
        ...(inviteCode === undefined ? {} : { inviteCode }),
      })
    } catch (error) {
      if (!disposed) onRegisterError(error, inviteCode)
      return
    }
    // `201`: аккаунт создан. Это фиксируется до загрузки сессии, и регистрация больше не повторяется.
    clearInvitation()
    if (disposed) return
    await finishWithSession()
  }

  /** Изменение поля убирает устаревший общий отказ; новый запрос не отправляется. */
  function onDraftEdited(): void {
    if (submitStatus.value === 'rejected' || submitStatus.value === 'failed') {
      submitStatus.value = 'idle'
      submitError.value = null
    }
  }

  /** После `201` повторяется только загрузка сессии. */
  function retrySession(): void {
    if (submitStatus.value !== 'session-error') return
    void finishWithSession()
  }

  function retryMode(): void {
    if (flow.value !== 'ordinary') return
    void loadMode(true)
  }

  const inviteLocation = computed(() => ({ name: 'register', query: inviteQuery(route.query) }))

  onScopeDispose(() => {
    disposed = true
    cancelInvitationWork()
    if (expiryTimer !== null) clearTimeout(expiryTimer)
    expiryTimer = null
  })

  enter(route.query)

  return {
    view,
    modeError,
    retryMode,
    inviteLocation,
    // B2/B3
    code,
    codeStatus,
    codeRetrySeconds: checkRetry.secondsLeft,
    openedByCheck,
    inputCode,
    submitCode,
    useOtherInvitation,
    // Данные аккаунта
    draft,
    submitStatus,
    submitError,
    submitBusy,
    submitLocked,
    registerRetrySeconds: registerRetry.secondsLeft,
    submit,
    onDraftEdited,
    retrySession,
  }
}

export type RegistrationFlow = ReturnType<typeof useRegistrationFlow>
