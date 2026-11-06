/** Данные форм живут только в открытом мастере и очищаются при смене user/tenant. */
import { inject, provide, shallowRef, watch, type InjectionKey } from 'vue'
import { useSessionStore } from '@/entities/session'
import type { CreateOrganizationValues } from '@/features/create-organization'
import type { ServiceValues } from '@/features/manage-services'
import { useLocationStep } from './location-step'

function createState() {
  const session = useSessionStore()
  const company = shallowRef<CreateOrganizationValues>()
  const service = shallowRef<ServiceValues>()
  watch(
    () => `${session.user?.id ?? ''}|${session.tenantId ?? ''}`,
    () => {
      company.value = undefined
      service.value = undefined
    },
    { flush: 'sync' },
  )
  return {
    company,
    service,
    location: useLocationStep({
      tenantId: () => session.tenantId,
      userId: () => session.user?.id ?? null,
    }),
  }
}
const stateKey: InjectionKey<ReturnType<typeof createState>> = Symbol('onboarding-state')
export function provideOnboardingState(): void {
  provide(stateKey, createState())
}
export function useOnboardingState() {
  return inject(stateKey, null)
}
