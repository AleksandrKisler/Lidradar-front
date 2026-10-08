<script setup lang="ts">
/**
 * Инструкция сохраняется в карточке; пример никогда не содержит настоящий секрет.
 * Она написана для разработчика, поэтому в начале сказано, кому её адресовать,
 * а одна кнопка копирует всё нужное для пересылки.
 */
import { computed, ref } from 'vue'
import { env } from '@/shared/config'
import { createUuid } from '@/shared/lib'
import { UiButton } from '@/shared/ui'
import { webhookRequestExample, webhookUrl } from '../model/webhook'

const props = defineProps<{ tenantId: string; connectionId: string; disconnected?: boolean }>()
const url = computed(() =>
  webhookUrl(props.tenantId, props.connectionId, env.VITE_API_ORIGIN || window.location.origin),
)
const localAddress = computed(() =>
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url.value).hostname),
)
const eventId = createUuid()
const occurredAt = new Date().toISOString()
const example = computed(() => webhookRequestExample(url.value, eventId, occurredAt))
/** Короткое письмо разработчику: адрес, метод, заголовок и пример. Секрета здесь нет. */
const developerBrief = computed(() =>
  [
    'Нужно настроить отправку сообщений клиентов в LidRadar по HTTP.',
    `Адрес: ${url.value}`,
    'Метод: POST, тип содержимого: application/json.',
    'Секрет подключения передавайте в заголовке X-LidRadar-Webhook-Secret. Секрет выдан отдельно, в адрес его добавлять нельзя.',
    '',
    'Пример запроса:',
    example.value,
  ].join('\n'),
)
const copied = ref('')
const copyError = ref(false)

async function copy(value: string, label: string): Promise<void> {
  copied.value = ''
  copyError.value = false
  try {
    await navigator.clipboard.writeText(value)
    copied.value = label
  } catch {
    copyError.value = true
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3 text-sm" data-testid="webhook-instructions">
    <p v-if="disconnected" class="font-semibold text-muted">
      Источник отключён: этот адрес больше не принимает события.
    </p>
    <div class="flex flex-col gap-2 rounded-control bg-canvas p-3">
      <p class="text-ink">
        Эту часть настраивает разработчик или подрядчик, который отвечает за вашу систему. Перешлите
        ему инструкцию: секрет в неё не попадает, его передайте отдельно.
      </p>
      <UiButton
        class="self-start"
        size="sm"
        variant="secondary"
        @click="copy(developerBrief, 'Инструкция скопирована')"
      >
        Скопировать для разработчика
      </UiButton>
    </div>
    <p>Настройте отправляющую систему: отправляйте JSON методом POST на адрес:</p>
    <code
      class="block select-all rounded-field bg-canvas p-3 break-all text-ink"
      data-testid="webhook-url"
      >{{ url }}</code
    >
    <UiButton
      class="self-start"
      size="sm"
      variant="secondary"
      @click="copy(url, 'Адрес скопирован')"
    >
      Скопировать адрес
    </UiButton>
    <p v-if="localAddress" class="text-warning">
      Это локальный адрес. Для внешнего отправителя нужен доступный ему HTTPS-адрес API с тем же
      путём.
    </p>
    <p>
      Передайте секрет подключения в заголовке
      <code class="break-all">X-LidRadar-Webhook-Secret</code>. Тип содержимого —
      <code>Content-Type: application/json</code>. Секрет не добавляйте в адрес.
    </p>
    <details class="min-w-0 rounded-control border border-line p-3">
      <summary class="cursor-pointer font-semibold text-brand-dark">Пример запроса</summary>
      <p class="mt-3 text-muted">
        В терминале задайте переменную окружения LIDRADAR_WEBHOOK_SECRET своим секретом. Пример
        создаст тестовый диалог «Проверка webhook».
      </p>
      <pre
        class="mt-3 max-h-80 overflow-auto rounded-field bg-canvas p-3 text-xs"
        tabindex="0"
        aria-label="Пример запроса webhook"
      ><code data-testid="webhook-example">{{ example }}</code></pre>
      <UiButton
        class="mt-3"
        size="sm"
        variant="secondary"
        @click="copy(example, 'Пример скопирован')"
      >
        Скопировать пример
      </UiButton>
      <p class="mt-3 text-xs text-muted">
        Для реальных сообщений передавайте свои ID диалога, контакта и сообщения, текст и время в
        ISO 8601 с часовым поясом. Каждому новому событию нужен уникальный id; при повторной
        доставке сохраните прежние id и тело. Изменённое тело с тем же id даст 409.
      </p>
    </details>
    <p v-if="copied" role="status" class="text-success">{{ copied }}</p>
    <p v-if="copyError" role="alert" class="text-danger">
      Не удалось скопировать. Выделите и скопируйте текст вручную.
    </p>
    <p>
      После отправки проверьте ответ: <code>202</code> и <code>status: RECEIVED</code> означают
      приём в обработку. При повторе <code>duplicate: true</code> означает, что событие уже
      сохранено; <code>status: PROCESSED</code> — обработано. <code>status: FAILED</code> — ошибка
      обработки, даже при 202; при <code>401</code> проверьте секрет. Затем нажмите «Обновить
      статус» в карточке и проверьте сообщение в разделе «Диалоги». Приём не означает завершения
      анализа.
    </p>
    <p class="text-muted">
      Адрес и пример останутся в карточке подключения. Секрет повторно не показывается. Если он
      утерян, подключите источник заново: у нового подключения будут новый адрес и секрет. Замените
      оба значения у отправителя и отключите прежнее подключение.
    </p>
  </div>
</template>
