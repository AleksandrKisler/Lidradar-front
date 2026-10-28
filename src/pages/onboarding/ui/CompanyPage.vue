<script setup lang="ts">
/**
 * Шаг 1 начала работы по макету «Компания · Шаг 1» (Figma 477:7927 и состояния): создание организации.
 * После создания сессия перечитана, новая организация выбрана — дальше точка и график. Сервер сам
 * определит, что уже выполнено (`/organization/onboarding`).
 */
import { RouterLink, useRouter } from 'vue-router'
import { UiAlert, UiButton, UiIcon, UiPageIntro } from '@/shared/ui'
import { useSessionStore } from '@/entities/session'
import { CreateOrganizationForm } from '@/features/create-organization'

defineProps<{
  /** Первичная загрузка: каркас формы без динамики (Figma «Первичная загрузка»). */
  loading?: boolean
}>()

const router = useRouter()
const session = useSessionStore()
/**
 * Право создать организацию читается один раз при открытии страницы (ADR 0057). Создание тратит право,
 * и после перечитывания сессии `canCreateOrganization` становится ложным: форма, привязанная к живому
 * значению, размонтировалась бы раньше, чем сообщит об успехе, и переход к следующему шагу потерялся бы.
 */
const mayCreate = session.canCreateOrganization

function onCreated(): void {
  void router.replace({ name: 'onboarding-location' })
}
</script>

<template>
  <div>
    <UiPageIntro
      compact
      title="Расскажите о компании"
      description="Эти данные задают контекст рисков, местное время и валюту расчётов."
    />
    <CreateOrganizationForm v-if="mayCreate || loading" :loading="loading" @created="onCreated">
      <template #default="{ submitting }">
        <div class="flex flex-col-reverse gap-5 md:flex-col md:gap-[30px]">
          <div class="flex gap-3 md:px-[31px]">
            <UiIcon name="info" class="mt-0.5 size-5 shrink-0 text-secondary" />
            <p class="text-note text-secondary">
              <span class="font-medium text-ink">Вы управляете действиями.</span><br />
              LidRadar помогает заметить риск и выбрать следующий шаг.<br />
              Самостоятельно клиентам не пишет.
            </p>
          </div>
          <div class="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
            <p class="text-sm leading-5 text-secondary">Далее: Точка и график</p>
            <div
              v-if="loading"
              class="flex h-input items-center justify-center rounded-button bg-line text-field leading-5 font-medium text-muted md:w-[268px]"
            >
              Создать компанию
            </div>
            <UiButton
              v-else
              type="submit"
              class="md:w-[268px]"
              :loading="submitting"
              :block="false"
            >
              <template v-if="submitting">
                <span aria-hidden="true">Создаём компанию…</span
                ><span class="sr-only">Создать компанию</span>
              </template>
              <template v-else>Создать компанию</template>
            </UiButton>
          </div>
        </div>
      </template>
    </CreateOrganizationForm>
    <UiAlert v-else tone="info" title="Организацию создают по приглашению платформы">
      У вашей учётной записи нет права создать организацию. Если вас пригласили в компанию, примите
      приглашение сотрудника; новую организацию можно создать с кодом приглашения платформы.
    </UiAlert>
    <div
      class="mt-[26px] flex flex-col items-center gap-2 border-t border-hairline pt-6 text-sm leading-5 text-secondary lg:-mx-10"
    >
      <p v-if="!loading && session.memberships.length">
        <RouterLink :to="{ name: 'workspaces' }" class="text-link hover:underline">
          Вернуться к рабочим пространствам
        </RouterLink>
      </p>
      <p class="flex items-center gap-2">
        Вас пригласили в существующую компанию?
        <RouterLink
          :to="{ name: 'invitations-accept' }"
          class="inline-flex items-center gap-2 text-link hover:underline"
        >
          Принять приглашение<UiIcon name="expand-more" class="size-4 -rotate-90" />
        </RouterLink>
      </p>
    </div>
  </div>
</template>
