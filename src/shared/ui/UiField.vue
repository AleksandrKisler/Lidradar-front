<script setup lang="ts">
/**
 * Обёртка поля формы: подпись, описание и ошибка связаны с элементом
 * управления через `id` и `aria-describedby`. Элемент управления передаётся
 * в слот и получает готовые атрибуты доступности.
 */
import { computed, defineAsyncComponent, useId } from 'vue'
import settingsHelp from './assets/settings-help.svg?no-inline'
const UiTooltip = defineAsyncComponent(() => import('./UiTooltip.vue'))

const props = withDefaults(
  defineProps<{
    label: string
    labelClass?: string | undefined
    descriptionClass?: string | undefined
    mutedDescription?: boolean | undefined
    help?: string | undefined
    touchHelp?: boolean | undefined
    helpAlignEnd?: boolean | undefined
    description?: string | undefined
    error?: string | undefined
    required?: boolean | undefined
    /** `compact` — подпись 14/20 для форм внутри карточек; `muted` — необязательное поле. */
    labelStyle?: 'default' | 'compact' | 'muted' | undefined
    /**
     * Ошибка заменяет подсказку, а не дополняет её (макеты Access «Ошибка»). Для остальных форм
     * подсказка остаётся: она может нести смысл, которого нет в тексте ошибки.
     */
    errorReplacesDescription?: boolean | undefined
    /** Просторная подача (макеты «Принять приглашение»): подпись 16/22, подсказка 14/20, отступы 12 px. */
    roomy?: boolean | undefined
    /** Подпись слева, элемент справа (макеты «Начало работы»); на телефоне — столбцом. */
    row?: boolean | undefined
  }>(),
  {
    description: '',
    labelClass: '',
    descriptionClass: '',
    mutedDescription: false,
    help: undefined,
    touchHelp: false,
    helpAlignEnd: false,
    error: '',
    required: false,
    labelStyle: 'default',
    errorReplacesDescription: false,
    roomy: false,
    row: false,
  },
)

const id = useId()
const descriptionId = `${id}-description`
const errorId = `${id}-error`

/** Подсказка показывается всегда; в формах Access (`errorReplacesDescription`) пока нет ошибки. */
const showDescription = computed(
  () => Boolean(props.description) && !(props.errorReplacesDescription && props.error),
)

/** Идентификаторы пояснений, которые нужно объявить у элемента управления. */
const describedBy = computed(() => {
  const ids: string[] = []
  if (showDescription.value) ids.push(descriptionId)
  if (props.error) ids.push(errorId)
  return ids.length ? ids.join(' ') : undefined
})
</script>

<template>
  <div
    :class="[
      'flex flex-col',
      roomy ? 'gap-2.5' : 'gap-2',
      row ? 'md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-0' : '',
    ]"
  >
    <div
      :class="help ? ['flex items-center gap-1.5', touchHelp ? 'max-md:min-h-11' : ''] : 'contents'"
    >
      <label
        :for="id"
        :class="[
          roomy ? 'leading-[22px]' : 'leading-5',
          labelClass,
          row ? 'md:flex md:h-[46px] md:items-center' : '',
          labelStyle === 'default' ? 'text-base font-medium text-ink' : 'text-sm',
          labelStyle === 'compact' ? 'font-medium text-ink' : '',
          touchHelp ? 'flex-1 md:flex-initial' : '',
          labelStyle === 'muted' ? 'text-muted' : '',
        ]"
      >
        {{ label }}
        <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      </label>
      <UiTooltip
        v-if="help"
        v-slot="{ describedBy: helpId }"
        :text="help"
        :above="touchHelp"
        :mobile-full="touchHelp"
        :align-end="helpAlignEnd"
        :width="touchHelp ? 320 : undefined"
      >
        <button
          type="button"
          :class="[
            'inline-flex shrink-0 items-center justify-center text-xs leading-none',
            touchHelp ? 'size-11 text-link md:size-5' : 'size-5 text-secondary',
          ]"
          :aria-label="`О поле «${label}»`"
          :aria-describedby="helpId"
        >
          <img v-if="touchHelp" :src="settingsHelp" width="20" height="20" alt="" />
          <span
            v-else
            class="inline-flex size-5 items-center justify-center rounded-full border border-current"
            >?</span
          >
        </button>
      </UiTooltip>
    </div>
    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />
    <p
      v-if="showDescription"
      :id="descriptionId"
      :class="[
        mutedDescription ? 'text-muted' : 'text-secondary',
        descriptionClass,
        roomy || row ? 'text-sm leading-5' : 'text-xs',
        row ? 'md:col-start-2 md:mt-2.5' : '',
        // Макет «Принять приглашение · Ошибка»: на десктопе ошибка заменяет подсказку, на планшете и телефоне обе строки.
        roomy && error ? 'lg:hidden' : '',
      ]"
    >
      {{ description }}
    </p>
    <p
      :id="errorId"
      :class="[
        'min-h-0 text-sm leading-5 text-danger',
        descriptionClass,
        roomy ? 'empty:-mt-2.5' : 'empty:-mt-2',
        row ? 'md:col-start-2 md:mt-2.5 md:empty:mt-0' : '',
      ]"
      aria-live="polite"
    >
      <template v-if="error">{{ error }}</template>
    </p>
  </div>
</template>
