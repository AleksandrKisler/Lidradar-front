<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getRisk, type Risk } from '@/entities/risk'
import { AcknowledgeRisk } from '@/features/acknowledge-risk'
import { env } from '@/shared/config'
import { UiButton } from '@/shared/ui'
const risk = ref<Risk | null>(null)
const loading = ref(true)
const error = ref(false)
async function load() {
  loading.value = true
  error.value = false
  try {
    risk.value = await getRisk()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<template>
  <p v-if="loading" role="status" class="p-8">Загрузка обращения…</p>
  <div v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-white p-6">
    <p class="mb-4">Не удалось загрузить обращение.</p>
    <UiButton @click="load">Повторить</UiButton>
  </div>
  <div v-else-if="risk" class="space-y-6">
    <header>
      <p class="text-sm text-slate-500">Radar / Риск #{{ risk.id }}</p>
      <h1 class="mt-2 text-3xl font-bold">{{ risk.customer }}</h1>
    </header>
    <div
      v-if="env.VITE_DEMO_MODE"
      class="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
    >
      Демо: данные примера, изменения не сохраняются.
    </div>
    <section
      class="rounded-2xl border border-slate-200 border-l-4 border-l-red-500 bg-white p-6"
      aria-labelledby="risk-title"
    >
      <div class="flex flex-wrap items-center justify-between gap-6">
        <div>
          <span class="text-sm font-semibold text-red-700">Критично</span>
          <h2 id="risk-title" class="mt-2 text-xl font-bold">Запись не подтверждена</h2>
          <p class="mt-3 text-slate-600">
            Клиент спросил доступное время. Подтверждение не найдено.
          </p>
        </div>
        <p class="text-2xl font-bold">
          {{
            new Intl.NumberFormat('ru-RU', {
              style: 'currency',
              currency: 'RUB',
              maximumFractionDigits: 0,
            }).format(risk.amount)
          }}
        </p>
      </div>
      <div class="mt-6 flex flex-wrap items-center gap-4">
        <AcknowledgeRisk v-if="env.VITE_DEMO_MODE" :risk="risk" @acknowledged="risk = $event" />
        <p v-else class="text-sm text-slate-600">Изменение статуса требует подключения API.</p>
        <p role="status" class="text-sm text-slate-600">
          {{
            risk.status === 'acknowledged'
              ? 'Обращение взято в работу'
              : risk.status === 'closed'
                ? 'Риск закрыт'
                : 'Ожидает действия менеджера'
          }}
        </p>
      </div>
    </section>
    <section class="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 class="text-xl font-bold">Контекст обращения</h2>
      <p class="mt-3 max-w-2xl leading-7 text-slate-600">
        Подтвердите удобное время с клиентом и зафиксируйте результат. Карточка демонстрирует
        загрузку данных и обработку риска.
      </p>
    </section>
  </div>
</template>
