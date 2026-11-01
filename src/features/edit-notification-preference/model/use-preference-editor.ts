import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  draftFromPreference,
  fetchPreferences,
  notificationKeys,
  putPreference,
  resetPreference,
  sameDraft,
  samePreference,
  toPreferenceRequest,
  validateDraft,
  type NotificationPreference,
  type PreferenceField,
} from '@/entities/notification'

export function usePreferenceEditor(
  props: { tenantId: string; preference: NotificationPreference },
  events: { saved: (value: NotificationPreference) => void; reset: () => void },
) {
  const client = useQueryClient()
  const baseline = shallowRef(props.preference)
  const draft = ref(draftFromPreference(baseline.value))
  const errors = ref<Partial<Record<PreferenceField, string>>>({})
  const error = shallowRef<unknown>(null)
  const readError = shallowRef<unknown>(null)
  const busy = ref(false),
    saved = ref(false),
    resetOpen = ref(false),
    resetAcknowledged = ref(false)
  let epoch = 0,
    disposed = false
  const dirty = computed(() => !sameDraft(draft.value, draftFromPreference(baseline.value)))
  const context = () => ({ tenant: props.tenantId, riskType: props.preference.riskType, epoch })
  const current = (input: ReturnType<typeof context>) =>
    !disposed &&
    input.epoch === epoch &&
    input.tenant === props.tenantId &&
    input.riskType === props.preference.riskType
  function accept(value: NotificationPreference) {
    baseline.value = value
    draft.value = draftFromPreference(value)
    errors.value = {}
  }
  watch(
    [() => props.tenantId, () => props.preference.riskType],
    () => {
      epoch++
      accept(props.preference)
      busy.value = saved.value = resetOpen.value = resetAcknowledged.value = false
      error.value = readError.value = null
    },
    { flush: 'sync' },
  )
  watch(
    () => props.preference,
    (value) => {
      if (!dirty.value && !busy.value && !samePreference(value, baseline.value)) accept(value)
    },
  )
  watch(
    draft,
    () => {
      saved.value = false
      if (Object.keys(errors.value).length) errors.value = validateDraft(draft.value)
    },
    { deep: true, flush: 'sync' },
  )
  async function refresh(input: ReturnType<typeof context>, resetting = false) {
    try {
      const rows = await fetchPreferences(input.tenant)
      if (!current(input)) return
      client.setQueryData(notificationKeys.preferences(input.tenant), rows)
      const row = rows.find((row) => row.riskType === input.riskType)
      if (resetting) {
        if (!row) throw new Error('Missing reset preference')
        accept(row)
      }
      readError.value = null
    } catch (cause) {
      if (current(input)) readError.value = cause
    }
  }
  async function submit() {
    if (busy.value || !dirty.value || resetAcknowledged.value) return
    errors.value = validateDraft(draft.value)
    if (Object.keys(errors.value).length) return
    epoch++
    const input = context(),
      body = toPreferenceRequest(draft.value)
    busy.value = true
    saved.value = false
    error.value = readError.value = null
    try {
      const result = await putPreference(input.tenant, input.riskType, body)
      if (!current(input)) return
      accept(result)
      saved.value = true
      client.setQueryData<NotificationPreference[]>(
        notificationKeys.preferences(input.tenant),
        (rows) => rows?.map((row) => (row.riskType === result.riskType ? result : row)),
      )
      events.saved(result)
      void refresh(input)
    } catch (cause) {
      if (current(input)) error.value = cause
    } finally {
      if (current(input)) busy.value = false
    }
  }
  // DELETE ACK is final. A failed GET retries only that read.
  async function reset() {
    if (busy.value) return
    epoch++
    const input = context()
    busy.value = true
    error.value = null
    try {
      if (!resetAcknowledged.value) {
        await resetPreference(input.tenant, input.riskType)
        if (!current(input)) return
        resetAcknowledged.value = true
        events.reset()
      }
      await refresh(input, true)
      if (current(input) && !readError.value) {
        resetOpen.value = resetAcknowledged.value = saved.value = false
      }
    } catch (cause) {
      if (current(input)) error.value = cause
    } finally {
      if (current(input)) busy.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
    epoch++
  })
  async function retryRead() {
    const input = context()
    await refresh(input, resetAcknowledged.value)
    if (current(input) && !readError.value) resetAcknowledged.value = false
  }
  return {
    baseline,
    draft,
    errors,
    dirty,
    busy,
    saved,
    error,
    readError,
    resetOpen,
    resetAcknowledged,
    submit,
    reset,
    retryRead,
  }
}
