/**
 * Точка входа. Порядок важен: Pinia — до маршрутизатора (guard-ы читают
 * хранилище сессии), контекст API — до первого запроса, поток сигналов —
 * после контекста, потому что его `401` отдаётся тому же обработчику.
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import { createAppRouter } from './router'
import { createAppQueryClient, installApiContext, installRealtime } from './config'
import { REALTIME_STATE_KEY } from '@/shared/api'
import { useSessionStore } from '@/entities/session'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()
const queryClient = createAppQueryClient()
const router = createAppRouter()

app.use(pinia)
app.use(VueQueryPlugin, { queryClient })
app.use(router)
const session = useSessionStore(pinia)
installApiContext({ session, queryClient, router })
const realtime = installRealtime({ session, queryClient })
app.provide(REALTIME_STATE_KEY, realtime.state)

app.mount('#app')
