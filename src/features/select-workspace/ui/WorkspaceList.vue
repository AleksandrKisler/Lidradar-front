<script setup lang="ts">
/**
 * Список рабочих пространств для явного выбора (Figma «Рабочие пространства»). Принимает только
 * идентификаторы из `/auth/me`; длинные названия переносятся. Пока пространство открывается, список
 * заблокирован и объявляет «Открываем пространство…»; при неудаче остаётся список и «Повторить».
 */
import { nextTick, ref, useTemplateRef } from 'vue'
import { UiButton, UiIcon, UiSpinner } from '@/shared/ui'
import { roleLabel, useSessionStore } from '@/entities/session'
import { useSwitchWorkspace } from '../model/use-switch-workspace'

const props = defineProps<{
  /** Первичная загрузка: каркас карточки без данных. */
  loading?: boolean | undefined
  /** Переход после выбора (например, на Radar); отказ считается неудачей открытия. */
  open?: ((tenantId: string) => Promise<unknown>) | undefined
  /** Перезагрузка страницы для повтора: модуль, который не загрузился, браузер повторно не запрашивает. */
  reload?: (() => void) | undefined
}>()
const emit = defineEmits<{ selected: [tenantId: string] }>()

const session = useSessionStore()
const { switchTo } = useSwitchWorkspace()
const pendingId = ref<string | null>(null)
const retryButton = useTemplateRef<{ $el: HTMLElement }>('retryButton')
const failedId = ref<string | null>(null)
/** Не открылась страница после выбора (`page`) либо выбранное пространство больше не в списке (`membership`). */
const failedKind = ref<'page' | 'membership'>('page')

async function choose(tenantId: string): Promise<void> {
  if (pendingId.value) return
  pendingId.value = tenantId
  failedId.value = null
  try {
    if (!(await switchTo(tenantId))) {
      failedId.value = tenantId
      failedKind.value = 'membership'
      return
    }
    await props.open?.(tenantId)
    emit('selected', tenantId)
  } catch {
    failedId.value = tenantId
    failedKind.value = 'page'
  } finally {
    pendingId.value = null
  }
  // Заблокированная кнопка выбора потеряла фокус: он переходит к «Повторить».
  if (failedId.value) {
    await nextTick()
    retryButton.value?.$el.focus()
  }
}

/**
 * Повтор. Страница не загрузилась — загружается заново целиком (выбор уже запомнен). Пространство
 * не нашлось — членства перечитываются: оно могло исчезнуть, и тогда выбор делается заново.
 */
async function retry(): Promise<void> {
  const id = failedId.value
  if (!id || pendingId.value) return
  if (failedKind.value === 'page') {
    ;(props.reload ?? (() => window.location.reload()))()
    return
  }
  pendingId.value = id
  try {
    await session.refresh()
  } catch {
    // Состояние сессии покажет повторная попытка выбора.
  } finally {
    pendingId.value = null
  }
  await choose(id)
}
</script>

<template>
  <div
    v-if="loading"
    class="flex min-h-[105px] items-center justify-between gap-4 rounded-card border border-line bg-paper px-[15px] py-6 md:px-[23px]"
    role="status"
    aria-label="Загрузка"
  >
    <div class="flex flex-col gap-3.5">
      <div class="h-4 w-40 rounded-full md:w-60 bg-line" />
      <div class="h-3 w-24 rounded-full md:w-28 bg-line" />
    </div>
    <div class="h-[30px] w-[120px] shrink-0 rounded-field bg-line" />
  </div>
  <template v-else>
    <ul class="flex flex-col gap-3" aria-label="Рабочие пространства">
      <li v-for="item in session.memberships" :key="item.tenantId">
        <button
          type="button"
          class="flex min-h-[105px] w-full items-center justify-between gap-4 rounded-card border border-line bg-paper px-[15px] py-6 md:px-[23px] text-left hover:border-brand disabled:cursor-wait disabled:hover:border-line"
          :aria-current="item.tenantId === session.tenantId ? 'true' : undefined"
          :disabled="pendingId !== null"
          @click="choose(item.tenantId)"
        >
          <span class="min-w-0">
            <span class="block text-[22px] leading-7 font-semibold break-words text-ink">{{
              item.organizationName
            }}</span>
            <span class="mt-1 block text-base leading-[22px] text-secondary">{{
              roleLabel(item.role)
            }}</span>
          </span>
          <span
            v-if="item.tenantId === session.tenantId"
            class="flex shrink-0 items-center gap-3 text-sm leading-5 font-medium text-link"
          >
            <UiIcon name="check" class="size-7 text-brand" />
            <span class="rounded-full bg-action-pale px-4 py-[5px]">Текущее</span>
          </span>
        </button>
      </li>
    </ul>
    <!-- Живая область смонтирована всегда: читалка объявляет появление текста, а не новый элемент. -->
    <p
      role="status"
      :class="
        pendingId
          ? 'mt-4 flex min-h-[46px] items-center gap-3 text-sm leading-5 text-secondary'
          : 'sr-only'
      "
    >
      <template v-if="pendingId"
        ><UiSpinner class="size-4 text-brand" />Открываем пространство…</template
      >
    </p>
    <div
      v-if="failedId && !pendingId"
      class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4"
    >
      <UiButton ref="retryButton" class="md:w-[180px]" @click="retry">Повторить</UiButton>
      <p
        class="flex items-center gap-2.5 text-sm leading-5 font-medium text-danger-ink"
        role="alert"
      >
        <UiIcon name="error" class="size-5 shrink-0" />Не удалось загрузить пространства
      </p>
    </div>
  </template>
</template>
