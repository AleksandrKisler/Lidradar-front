/**
 * Модель шага 2 «Точки и графики» (US-M02-04, решение без правок backend от 30.10.2026).
 *
 * Страница владеет выбранной точкой и черновиками недель всех активных точек, ключ — ID точки.
 * Черновик живёт в контексте «пользователь + организация + экземпляр страницы»: смена контекста
 * или уход со страницы сбрасывают его, поздние ответы прежнего контекста не применяются.
 *
 * Создание точки — существующий POST, затем PUT полной стандартной недели (10:00–19:00 у рабочих
 * дней стартового шаблона). После подтверждённого POST повторяется только PUT того же ID.
 * «Сохранить и продолжить» сверяет список свежим GET, последовательно отправляет PUT только
 * изменённых или неподтверждённых недель и останавливается на первом сбое; неизвестный исход
 * PUT сверяется чтением без автоматической повторной записи. Переход дальше — только после
 * свежего подтверждения недель и LOCATION по прежнему серверному правилу.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { isApiError, isUnknownResult, shouldRetryRead } from '@/shared/api'
import {
  completeWeekFromHours,
  fetchLocations,
  locationKeys,
  normalizeWeek,
  onboardingDefaultWeek,
  replaceBusinessHours,
  sameServerWeek,
  sameWeek,
  toBusinessHoursRequest,
  weekFromHours,
  weekIssues,
  type DayDraft,
  type DayIssue,
  type Location,
} from '@/entities/location'
import {
  fetchOnboardingStatus,
  isOnboardingStepDone,
  organizationKeys,
} from '@/entities/organization'

/**
 * Исход последней записи недели: `pending` — PUT в пути; `ack` — подтверждён; `rejected` —
 * сервер отказал (400/401/403/404); `unknown` — исход неизвестен и сверка чтением не удалась;
 * `diverged` — сверка показала другую неделю, нужен ручной повтор; `not_sent` — очередь
 * остановилась раньше этой точки.
 */
export type WriteState =
  'idle' | 'pending' | 'ack' | 'rejected' | 'unknown' | 'diverged' | 'not_sent'

export interface LocationDraft {
  id: string
  name: string
  timezone: string
  /** Редактируемая неделя; у выходных времена могут храниться, но не отправляются. */
  days: DayDraft[]
  /** Неделя, подтверждённая сервером; `null` — инициализация ещё не подтверждена. */
  baseline: DayDraft[] | null
  /** Локальная ревизия: растёт с каждой правкой. */
  revision: number
  write: WriteState
  error: unknown
  /** Последняя отправленная версия — для сверки неизвестного исхода. */
  sent: { timezone: string; days: DayDraft[] } | null
}

/** Сбой команды шага, который не относится к одной неделе. */
export type StepFailure =
  | { kind: 'read'; error: unknown }
  | { kind: 'recovered'; locationId: string }
  | { kind: 'incomplete' }
  /** Финальное чтение вернуло другую неделю, чем подтверждённая желаемая версия. */
  | { kind: 'diverged'; locationId: string }

const ISSUE_TEXT: Record<DayIssue, string> = {
  time: 'Укажите время начала и окончания.',
  order: 'Время окончания должно быть позже времени начала.',
}
/** Предлог и винительный падеж для подсказки «Исправьте время в понедельник» / «во вторник». */
const ACCUSATIVE: Record<number, string> = {
  1: 'в понедельник',
  2: 'во вторник',
  3: 'в среду',
  4: 'в четверг',
  5: 'в пятницу',
  6: 'в субботу',
  7: 'в воскресенье',
}

/** Почему шаг нельзя сохранить: одна модель для всех ширин, текст выбирает представление. */
export type BlockReason =
  | { kind: 'no-points' }
  /** Неверна выбранная точка; `weekday` — первый день с ошибкой (null — ошибка не дня). */
  | { kind: 'selected-invalid'; name: string; weekday: number | null }
  | { kind: 'other-invalid'; name: string }
  | { kind: 'unconfirmed'; name: string }

/**
 * Текст подсказки над кнопкой шага. Desktop и планшет называют день выбранной точки (Figma 08:
 * «Исправьте время в понедельник…»), телефон — саму точку (Figma phone-08: «Исправьте график: …»):
 * день там виден под селектором вместе с ошибкой.
 */
export function blockReasonText(reason: BlockReason, view: 'desktop' | 'phone'): string {
  switch (reason.kind) {
    case 'no-points':
      return 'Сначала добавьте точку.'
    case 'selected-invalid':
      if (view === 'phone') return `Исправьте график: ${reason.name}.`
      return reason.weekday
        ? `Исправьте время ${ACCUSATIVE[reason.weekday]}, чтобы продолжить.`
        : 'Исправьте график, чтобы продолжить.'
    case 'other-invalid':
      return `Исправьте график: ${reason.name}.`
    case 'unconfirmed':
      return `Сохраните график точки: ${reason.name}.`
  }
}

/** Ошибки дней черновика текстом; пустой объект — неделя корректна. */
export function draftErrors(days: readonly DayDraft[]): Record<number, string> {
  const issues = weekIssues(days) ?? {}
  return Object.fromEntries(
    Object.entries(issues)
      .filter(([weekday]) => weekday !== '0')
      .map(([weekday, issue]) => [weekday, ISSUE_TEXT[issue]]),
  )
}

export function isDraftValid(draft: Pick<LocationDraft, 'days'>): boolean {
  return weekIssues(draft.days) === null
}

/** Нужна ли запись: неделя не подтверждена, изменена после подтверждения или разошлась при сверке. */
export function needsWrite(draft: LocationDraft): boolean {
  return draft.baseline === null || !sameWeek(normalizeWeek(draft.days), draft.baseline)
}

/** Неделя, полученная повтором чтений: штатный ограниченный retry, мутации без него. */
async function withReadRetry<T>(read: () => Promise<T>): Promise<T> {
  let failures = 0
  for (;;) {
    try {
      return await read()
    } catch (error) {
      failures += 1
      if (!shouldRetryRead(failures, error)) throw error
    }
  }
}

function draftFrom(location: Location): LocationDraft {
  const week = completeWeekFromHours(location.businessHours)
  return {
    id: location.id,
    name: location.name,
    timezone: location.timezone,
    // Пустая неделя — незавершённая инициализация: стандартный черновик и повтор только PUT.
    // Неполный ответ показывается как есть и не считается подтверждённой неделей.
    days:
      week ??
      (location.businessHours.length > 0
        ? weekFromHours(location.businessHours)!
        : onboardingDefaultWeek()),
    baseline: week,
    revision: 0,
    write: 'idle',
    error: null,
    sent: null,
  }
}

export function useLocationStep(context: {
  tenantId: () => string | null
  userId: () => string | null
}) {
  const queryClient = useQueryClient()
  const drafts = ref<LocationDraft[]>([])
  const selectedId = ref<string | null>(null)
  const busy = ref<'init' | 'save' | null>(null)
  const failure = ref<StepFailure | null>(null)

  /** Эпоха контекста: команда применяет ответ, только если эпоха не сменилась. */
  let epoch = 0
  const contextKey = computed(() => `${context.userId() ?? ''}|${context.tenantId() ?? ''}`)
  watch(contextKey, () => {
    epoch += 1
    drafts.value = []
    selectedId.value = null
    busy.value = null
    failure.value = null
  })
  onScopeDispose(() => {
    epoch += 1
  })

  const find = (id: string | null) => drafts.value.find((draft) => draft.id === id) ?? null
  const selected = computed(() => find(selectedId.value))

  function select(id: string): void {
    if (busy.value || !find(id)) return
    selectedId.value = id
  }

  /**
   * Объединяет список сервера с черновиками. Новые активные точки добавляются, неактивные и
   * исчезнувшие уходят из шага. Чистые записи принимают серверную неделю, изменённые черновики,
   * неподтверждённые версии и неудачные записи не перезаписываются. Название и пояс — серверные.
   */
  function merge(list: readonly Location[]): void {
    const next: LocationDraft[] = []
    for (const location of list) {
      if (!location.active) continue
      const current = find(location.id)
      if (!current) {
        next.push(draftFrom(location))
        continue
      }
      current.name = location.name
      current.timezone = location.timezone
      const week = completeWeekFromHours(location.businessHours)
      const settled = current.write === 'idle' || current.write === 'ack'
      const clean =
        current.baseline !== null && sameWeek(normalizeWeek(current.days), current.baseline)
      if (week && settled && (clean || (current.baseline === null && current.revision === 0))) {
        current.days = week
        current.baseline = week
      }
      next.push(current)
    }
    drafts.value = next
    if (!find(selectedId.value)) selectedId.value = next[0]?.id ?? null
  }

  function publish(tenant: string, list: Location[]): void {
    queryClient.setQueryData(locationKeys.list(tenant), list)
    merge(list)
  }

  function updateDays(id: string, days: DayDraft[]): void {
    const draft = find(id)
    if (!draft || busy.value) return
    if (sameWeek(draft.days, days)) return
    draft.days = days
    draft.revision += 1
  }

  /** Сверка неизвестного исхода: совпало — подтверждаем, отличается — ждём ручного повтора. */
  async function reconcile(
    draft: LocationDraft,
    tenant: string,
    run: number,
  ): Promise<'ack' | 'stop'> {
    const sent = draft.sent!
    draft.write = 'unknown'
    let list: Location[]
    try {
      list = await withReadRetry(() => fetchLocations(tenant))
    } catch {
      return 'stop'
    }
    if (run !== epoch) return 'stop'
    const server = list.find((location) => location.id === draft.id)
    if (server && sameServerWeek(server, sent.timezone, sent.days)) {
      draft.baseline = sent.days
      draft.write = 'ack'
      draft.error = null
      publish(tenant, list)
      return 'ack'
    }
    draft.write = 'diverged'
    draft.baseline = server ? completeWeekFromHours(server.businessHours) : null
    publish(tenant, list)
    return 'stop'
  }

  /** Один PUT полной недели. Повтора записи внутри нет: сбой останавливает команду. */
  async function put(draft: LocationDraft, tenant: string, run: number): Promise<'ack' | 'stop'> {
    const days = normalizeWeek(draft.days)
    const timezone = draft.timezone
    draft.write = 'pending'
    draft.error = null
    draft.sent = { timezone, days }
    try {
      const saved = await replaceBusinessHours(
        tenant,
        draft.id,
        toBusinessHoursRequest(timezone, days),
      )
      if (run !== epoch) return 'stop'
      if (sameServerWeek(saved, timezone, days)) {
        draft.baseline = days
        draft.write = 'ack'
        return 'ack'
      }
      // Разобранный, но несовпавший ответ: исход неизвестен.
      return await reconcile(draft, tenant, run)
    } catch (error) {
      if (run !== epoch) return 'stop'
      if (isUnknownResult(error)) {
        draft.error = error
        return await reconcile(draft, tenant, run)
      }
      draft.write = 'rejected'
      draft.error = error
      // 404: точка могла стать недоступной — перечитываем список, не пересоздавая её.
      if (isApiError(error) && error.httpStatus === 404)
        void withReadRetry(() => fetchLocations(tenant))
          .then((list) => run === epoch && publish(tenant, list))
          .catch(() => null)
      return 'stop'
    }
  }

  function refreshOnboarding(tenant: string): void {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.onboarding(tenant) })
  }

  /**
   * Инициализация или её ручной повтор: только PUT недели существующей точки. Если исход
   * прошлого PUT неизвестен и сверка не удалась, сначала снова читаем список, а не пишем.
   */
  async function initialize(id: string): Promise<boolean> {
    const tenant = context.tenantId()
    const draft = find(id)
    if (!tenant || !draft || busy.value || !isDraftValid(draft)) return false
    const run = epoch
    busy.value = 'init'
    failure.value = null
    try {
      const result =
        draft.write === 'unknown' && draft.sent
          ? await reconcile(draft, tenant, run)
          : await put(draft, tenant, run)
      if (result === 'ack' && run === epoch) refreshOnboarding(tenant)
      return result === 'ack'
    } finally {
      if (run === epoch) busy.value = null
    }
  }

  /** Метка текущего контекста: команда, начатая при другой метке, свой ответ не применяет. */
  function token(): number {
    return epoch
  }

  /**
   * Ответ POST 201: точка добавляется один раз, выбирается и сразу получает PUT стандартной недели.
   * `startedAt` — метка контекста в момент открытия окна: ответ прежней организации отбрасывается.
   */
  async function addCreated(location: Location, startedAt: number = epoch): Promise<boolean> {
    if (startedAt !== epoch) return false
    if (!find(location.id)) drafts.value = [...drafts.value, draftFrom(location)]
    selectedId.value = location.id
    const draft = find(location.id)!
    if (draft.baseline !== null) return true
    return initialize(location.id)
  }

  /**
   * Неизвестный исход POST: свежая сверка списка без повтора POST. Точка, которой не было до
   * отправки, появляется как незавершённая инициализация; её ID получен из списка, а не по имени.
   */
  async function reconcileCreate(
    knownIds: ReadonlySet<string>,
    startedAt: number = epoch,
  ): Promise<string | null> {
    const tenant = context.tenantId()
    if (!tenant || startedAt !== epoch) return null
    const run = epoch
    try {
      const list = await withReadRetry(() => fetchLocations(tenant))
      if (run !== epoch) return null
      publish(tenant, list)
      const created = drafts.value.find((draft) => !knownIds.has(draft.id))
      if (created) selectedId.value = created.id
      return created?.id ?? null
    } catch {
      return null
    }
  }

  /**
   * PATCH ACK: реквизиты меняются у той же точки, черновик недели не трогается.
   * `startedAt` — метка контекста при открытии окна: ответ прежней организации отбрасывается.
   */
  function applyPatched(location: Location, startedAt: number = epoch): void {
    if (startedAt !== epoch) return
    const current = find(location.id)
    if (!current) return
    if (!location.active) {
      drafts.value = drafts.value.filter((draft) => draft.id !== location.id)
      if (selectedId.value === location.id) selectedId.value = drafts.value[0]?.id ?? null
      return
    }
    current.name = location.name
    current.timezone = location.timezone
  }

  /** «Сохранить и продолжить»: `true` — все нужные недели и LOCATION подтверждены свежим чтением. */
  async function saveAll(): Promise<boolean> {
    const tenant = context.tenantId()
    if (!tenant || busy.value) return false
    const run = epoch
    busy.value = 'save'
    failure.value = null
    try {
      // 1. Свежий состав без перезаписи черновиков; заодно сверяются неизвестные исходы.
      let list: Location[]
      try {
        list = await withReadRetry(() => fetchLocations(tenant))
      } catch (error) {
        if (run === epoch) failure.value = { kind: 'read', error }
        return false
      }
      if (run !== epoch) return false
      const known = new Set(drafts.value.map((draft) => draft.id))
      for (const draft of drafts.value) {
        if ((draft.write !== 'unknown' && draft.write !== 'diverged') || !draft.sent) continue
        const server = list.find((location) => location.id === draft.id)
        if (server && sameServerWeek(server, draft.sent.timezone, draft.sent.days)) {
          draft.baseline = draft.sent.days
          draft.write = 'ack'
        } else {
          draft.write = 'diverged'
          draft.baseline = server ? completeWeekFromHours(server.businessHours) : null
        }
      }
      publish(tenant, list)
      const recovered = drafts.value.find(
        (draft) => !known.has(draft.id) && draft.baseline === null,
      )
      if (recovered) {
        selectedId.value = recovered.id
        failure.value = { kind: 'recovered', locationId: recovered.id }
        return false
      }
      if (drafts.value.length === 0 || !drafts.value.every(isDraftValid)) return false

      // 2. Последовательные PUT только нужных недель в порядке списка.
      const queue = drafts.value.filter(needsWrite)
      for (const [index, draft] of queue.entries()) {
        const result = await put(draft, tenant, run)
        if (run !== epoch) return false
        if (result !== 'ack') {
          for (const rest of queue.slice(index + 1)) rest.write = 'not_sent'
          selectedId.value = draft.id
          return false
        }
      }

      // 3. Свежие точки и статус: подтверждённые недели и LOCATION по серверному правилу.
      let finalList: Location[]
      let status: Awaited<ReturnType<typeof fetchOnboardingStatus>>
      try {
        ;[finalList, status] = await Promise.all([
          withReadRetry(() => fetchLocations(tenant)),
          withReadRetry(() => fetchOnboardingStatus(tenant)),
        ])
      } catch (error) {
        if (run === epoch) failure.value = { kind: 'read', error }
        return false
      }
      if (run !== epoch) return false
      // Желаемые недели фиксируются до слияния: merge обновил бы чистые черновики и baseline
      // серверными данными, и известное расхождение прошло бы незамеченным. При расхождении
      // черновик пользователя остаётся, сервер становится baseline, а повтор записи — только
      // по следующей команде пользователя.
      const diverged: LocationDraft[] = []
      for (const draft of drafts.value) {
        const server = finalList.find((location) => location.id === draft.id && location.active)
        const desired = { timezone: draft.timezone, days: normalizeWeek(draft.days) }
        if (!server || sameServerWeek(server, desired.timezone, desired.days)) continue
        draft.write = 'diverged'
        draft.error = null
        draft.sent = desired
        draft.baseline = completeWeekFromHours(server.businessHours)
        diverged.push(draft)
      }
      queryClient.setQueryData(organizationKeys.onboarding(tenant), status)
      publish(tenant, finalList)
      if (diverged[0]) {
        selectedId.value = diverged[0].id
        failure.value = { kind: 'diverged', locationId: diverged[0].id }
        return false
      }
      const mismatch = drafts.value.find((draft) => {
        const server = finalList.find((location) => location.id === draft.id)
        return !server || !draft.baseline || !sameServerWeek(server, draft.timezone, draft.baseline)
      })
      if (mismatch || drafts.value.length === 0 || !isOnboardingStepDone(status, 'LOCATION')) {
        if (mismatch) {
          const server = finalList.find((location) => location.id === mismatch.id)
          mismatch.baseline = server ? completeWeekFromHours(server.businessHours) : null
          selectedId.value = mismatch.id
        }
        failure.value = { kind: 'incomplete' }
        return false
      }
      return true
    } finally {
      if (run === epoch) busy.value = null
    }
  }

  const invalid = computed(() => drafts.value.filter((draft) => !isDraftValid(draft)))
  const unconfirmed = computed(() => drafts.value.filter((draft) => draft.baseline === null))

  /** Первая проблемная точка, кроме выбранной: телефон называет её и ведёт к её графику. */
  const otherInvalid = computed(
    () => invalid.value.find((draft) => draft.id !== selectedId.value) ?? null,
  )

  /** Причина недоступности сохранения; `null` — шаг можно сохранить. Текст — `blockReasonText`. */
  const blockReason = computed<BlockReason | null>(() => {
    if (drafts.value.length === 0) return { kind: 'no-points' }
    const current = selected.value
    if (current && !isDraftValid(current)) {
      const weekday = Number(Object.keys(draftErrors(current.days))[0] ?? 0)
      return { kind: 'selected-invalid', name: current.name, weekday: weekday || null }
    }
    if (otherInvalid.value) return { kind: 'other-invalid', name: otherInvalid.value.name }
    const pending = unconfirmed.value[0]
    if (pending) return { kind: 'unconfirmed', name: pending.name }
    return null
  })

  return {
    drafts,
    selectedId,
    selected,
    busy,
    failure,
    invalid,
    otherInvalid,
    blockReason,
    token,
    merge,
    select,
    updateDays,
    addCreated,
    initialize,
    reconcileCreate,
    applyPatched,
    saveAll,
  }
}

export type LocationStep = ReturnType<typeof useLocationStep>
