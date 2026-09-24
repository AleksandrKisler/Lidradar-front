<script setup lang="ts">
/**
 * Список переписок с поиском и переключателем «С риском».
 *
 * Поиск и фильтр выполняет сервер по всему набору организации; ввод
 * откладывается, чтобы не слать запрос на каждую букву. Страницы подгружаются
 * по курсору, порядок серверный. Пустой результат с фильтрами отличается от
 * пустой организации: первый предлагает сбросить фильтры.
 */
import { computed, onScopeDispose, ref, toRef, watch } from 'vue'
import {
  UiAlert,
  UiButton,
  UiCard,
  UiEmptyState,
  UiErrorState,
  UiInput,
  UiSkeleton,
} from '@/shared/ui'
import {
  SEARCH_MAX_LENGTH,
  toConversationRow,
  useConversationsQuery,
  type ConversationFilters,
} from '@/entities/conversation'
import ConversationRow from './ConversationRow.vue'

const props = defineProps<{
  tenantId: string
  filters: ConversationFilters
  selectedId: string | null
  timeZone: string
}>()
const emit = defineEmits<{ 'update:filters': [filters: ConversationFilters] }>()

const query = useConversationsQuery(toRef(props, 'tenantId'), toRef(props, 'filters'))

const rows = computed(() =>
  (query.data.value?.pages ?? []).flatMap((page) => page.items.map(toConversationRow)),
)
const hasFilters = computed(() => Boolean(props.filters.search || props.filters.withRisk))

/** Локальное значение поля поиска; в фильтры уходит с задержкой. */
const searchInput = ref(props.filters.search ?? '')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.filters.search,
  (value) => {
    if ((value ?? '') !== searchInput.value) searchInput.value = value ?? ''
  },
)
watch(searchInput, (value) => {
  if (searchTimer !== null) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const trimmed = value.trim().slice(0, SEARCH_MAX_LENGTH)
    if (trimmed !== (props.filters.search ?? '')) {
      emit('update:filters', { ...props.filters, search: trimmed || undefined })
    }
  }, 300)
})
onScopeDispose(() => {
  if (searchTimer !== null) clearTimeout(searchTimer)
})

function setWithRisk(value: boolean): void {
  emit('update:filters', { ...props.filters, withRisk: value || undefined })
}

function resetFilters(): void {
  searchInput.value = ''
  emit('update:filters', {})
}

const now = ref(new Date())
const timer = setInterval(() => {
  now.value = new Date()
}, 60_000)
onScopeDispose(() => clearInterval(timer))
</script>

<template>
  <UiCard as="section" aria-labelledby="conversation-list-title" class="flex flex-col gap-4">
    <h2 id="conversation-list-title" class="sr-only">Список переписок</h2>
    <label class="flex flex-col gap-1.5 text-sm font-medium text-ink">
      Поиск по имени, телефону или почте
      <UiInput
        v-model="searchInput"
        type="search"
        name="search"
        placeholder="Например, Дмитрий"
        autocomplete="off"
        :maxlength="SEARCH_MAX_LENGTH"
      />
    </label>
    <div class="flex gap-2" role="group" aria-label="Фильтр по рискам">
      <UiButton
        size="sm"
        :variant="filters.withRisk ? 'secondary' : 'primary'"
        :aria-pressed="!filters.withRisk"
        @click="setWithRisk(false)"
      >
        Все диалоги
      </UiButton>
      <UiButton
        size="sm"
        :variant="filters.withRisk ? 'primary' : 'secondary'"
        :aria-pressed="Boolean(filters.withRisk)"
        @click="setWithRisk(true)"
      >
        С риском
      </UiButton>
    </div>

    <UiAlert
      v-if="query.isError.value && rows.length"
      tone="warning"
      title="Не удалось обновить список"
    >
      Показан последний успешный снимок.
    </UiAlert>

    <div
      v-if="query.isPending.value"
      role="status"
      aria-label="Загрузка переписок"
      class="flex flex-col gap-3"
    >
      <UiSkeleton v-for="index in 5" :key="index" class="h-16 w-full" />
    </div>
    <UiErrorState
      v-else-if="query.isError.value && !rows.length"
      :error="query.error.value"
      title="Не удалось загрузить переписки"
      @retry="query.refetch()"
    />
    <UiEmptyState
      v-else-if="!rows.length && hasFilters"
      title="Ничего не найдено"
      description="По этим условиям переписок нет. Измените запрос или сбросьте фильтры."
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="resetFilters">Сбросить фильтры</UiButton>
      </template>
    </UiEmptyState>
    <UiEmptyState
      v-else-if="!rows.length"
      title="Переписок пока нет"
      description="Как только подключённый канал получит первое сообщение, диалог появится здесь."
    />
    <template v-else>
      <ul class="flex flex-col gap-1" aria-label="Список диалогов">
        <ConversationRow
          v-for="row in rows"
          :key="row.id"
          :row="row"
          :time-zone="timeZone"
          :now="now"
          :selected="row.id === selectedId"
        />
      </ul>
      <div class="flex justify-center pt-1">
        <UiButton
          v-if="query.hasNextPage.value"
          variant="secondary"
          size="sm"
          :loading="query.isFetchingNextPage.value"
          @click="query.fetchNextPage()"
        >
          Показать ещё
        </UiButton>
        <p v-else class="text-xs text-muted">Это все переписки по выбранным условиям.</p>
      </div>
      <UiAlert
        v-if="query.isFetchNextPageError.value"
        tone="danger"
        title="Не удалось загрузить страницу"
      >
        Повторите попытку: уже загруженные переписки на месте.
      </UiAlert>
    </template>
  </UiCard>
</template>
