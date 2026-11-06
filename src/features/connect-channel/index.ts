import { defineAsyncComponent } from 'vue'

export { default as ConnectChannelDialog } from './ui/ConnectChannelDialog.vue'
export { useConnectChannel } from './model/use-connect-channel'
export { connectChannelSchema } from './model/schema'
export const TelegramInstructionDialog = defineAsyncComponent(
  () => import('./ui/TelegramInstructionDialog.vue'),
)
