<script setup lang="ts">
/** Виртуальные клиенты: черновик (только в браузере) и отправленные переписки со статусом сверки. */
import { UiBadge, UiButton, UiCard } from '@/shared/ui'
import { verdictBadge, type SandboxConversation } from '@/entities/sandbox'

defineProps<{
  draft: { name: string; templateName: string } | null
  conversations: readonly SandboxConversation[]
  templateNames: Record<string, string>
  selectedId: string | null
  draftSelected: boolean
}>()
const emit = defineEmits<{ select: [id: string | null]; create: [] }>()
</script>

<template>
  <UiCard
    as="section"
    :padded="false"
    aria-labelledby="sandbox-clients-title"
    class="flex flex-col"
  >
    <div class="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <h2 id="sandbox-clients-title" class="text-base font-semibold text-ink">Клиенты</h2>
      <span class="text-xs text-muted">{{ conversations.length + (draft ? 1 : 0) }}</span>
    </div>
    <div class="px-4 pb-3">
      <UiButton variant="secondary" block @click="emit('create')">Новый клиент</UiButton>
    </div>
    <ul class="flex flex-col gap-1 px-2 pb-3" aria-label="Виртуальные клиенты">
      <li v-if="draft">
        <button
          type="button"
          :aria-current="draftSelected ? 'true' : undefined"
          :class="[
            'flex w-full flex-col gap-1 rounded-control px-3 py-2.5 text-left transition-colors',
            draftSelected ? 'bg-brand-pale' : 'hover:bg-canvas',
          ]"
          @click="emit('select', null)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-semibold text-ink">{{ draft.name }}</span>
            <UiBadge>Черновик</UiBadge>
          </span>
          <span :class="['truncate text-xs', draftSelected ? 'text-brand-dark' : 'text-muted']">{{
            draft.templateName
          }}</span>
        </button>
      </li>
      <li v-for="item in conversations" :key="item.id">
        <button
          type="button"
          :aria-current="item.id === selectedId ? 'true' : undefined"
          :class="[
            'flex w-full flex-col gap-1 rounded-control px-3 py-2.5 text-left transition-colors',
            item.id === selectedId ? 'bg-brand-pale' : 'hover:bg-canvas',
          ]"
          @click="emit('select', item.id)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-semibold text-ink">{{ item.contactName }}</span>
            <UiBadge :tone="verdictBadge(item.status.state).tone">{{
              verdictBadge(item.status.state).label
            }}</UiBadge>
          </span>
          <span
            :class="['truncate text-xs', item.id === selectedId ? 'text-brand-dark' : 'text-muted']"
            >{{ templateNames[item.templateCode] ?? item.templateCode }}</span
          >
        </button>
      </li>
    </ul>
    <p v-if="!draft && !conversations.length" class="px-5 pb-5 text-sm text-muted">
      Создайте первого клиента: шаблон заполнит переписку, текст можно поправить.
    </p>
  </UiCard>
</template>
