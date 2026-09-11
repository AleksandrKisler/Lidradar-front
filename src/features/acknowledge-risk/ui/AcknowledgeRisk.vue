<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { acknowledgeRisk, type Risk } from '@/entities/risk'
import { UiButton } from '@/shared/ui'
const props = defineProps<{ risk: Risk }>()
const emit = defineEmits<{ acknowledged: [risk: Risk] }>()
const open = ref(false)
function confirm() {
  emit('acknowledged', acknowledgeRisk(props.risk))
  open.value = false
}
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child
      ><UiButton :disabled="risk.status !== 'open'">{{
        risk.status === 'open' ? 'Признать риск' : 'Риск принят'
      }}</UiButton></DialogTrigger
    >
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-slate-950/50" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
      >
        <DialogTitle class="text-xl font-bold">Признать риск?</DialogTitle>
        <DialogDescription class="mt-3 text-slate-600"
          >Вы берёте в работу обращение клиента {{ risk.customer }}. В демо изменение действует до
          перезагрузки страницы.</DialogDescription
        >
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <DialogClose as-child><UiButton variant="secondary">Отмена</UiButton></DialogClose>
          <UiButton @click="confirm">Подтвердить</UiButton>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
