<script setup lang="ts">
/** Кнопка «Подтвердить оплату» с диалогом; состояние отправки живёт в диалоге. */
import { ref } from 'vue'
import { UiButton } from '@/shared/ui'
import type { RevenueConfirmation } from '@/entities/revenue'
import type { RevenueEvidence } from '../model/evidence'
import ConfirmRevenueDialog from './ConfirmRevenueDialog.vue'

defineProps<{ evidence: RevenueEvidence }>()
const emit = defineEmits<{ confirmed: [confirmation: RevenueConfirmation] }>()

const open = ref(false)
</script>

<template>
  <div>
    <UiButton variant="secondary" block @click="open = true">Подтвердить оплату</UiButton>
    <ConfirmRevenueDialog
      v-model:open="open"
      :evidence="evidence"
      @confirmed="(confirmation) => emit('confirmed', confirmation)"
    />
  </div>
</template>
