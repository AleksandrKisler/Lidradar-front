<script setup lang="ts">
/**
 * Регистрация. Утверждённого макета нет (GAP-DESIGN-014): страница собрана
 * из тех же примитивов, что и вход. После успеха — общий boot-поток, который
 * приведёт нового пользователя к созданию организации (если код платформы дал
 * такое право), в рабочее пространство (код сотрудника) или к вводу кода.
 *
 * Регистрация по приглашениям (ADR 0057): код из ссылки `/register?code=…`
 * читается один раз и сразу убирается из адреса, чтобы история браузера его не хранила.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UiCard } from '@/shared/ui'
import { useRegistrationModeQuery } from '@/entities/session'
import { RegisterForm } from '@/features/auth-session'

const router = useRouter()
const route = useRoute()
const registration = useRegistrationModeQuery()

const linkedCode = route.query.code
const initialCode = typeof linkedCode === 'string' ? linkedCode : undefined
if (linkedCode !== undefined) {
  const rest = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'code'))
  void router.replace({ name: 'register', query: rest })
}

/** Пока режим неизвестен, текст описывает закрытую регистрацию: она безопаснее для ожиданий. */
const subtitle = computed(() =>
  registration.data.value?.mode === 'open'
    ? 'Первую организацию вы создадите сразу после регистрации.'
    : 'Регистрация по приглашению: введите код, который вам передали.',
)

function onSuccess(): void {
  void router.replace({ name: 'radar' })
}
</script>

<template>
  <UiCard :padded="false" class="flex flex-col gap-6 p-[23px] md:p-[31px]">
    <div class="flex flex-col gap-2">
      <p class="text-meta font-medium text-secondary">Новый аккаунт</p>
      <h1 class="text-metric font-semibold text-ink md:text-4xl md:leading-10">Создать аккаунт</h1>
      <p class="text-note text-secondary">{{ subtitle }}</p>
    </div>
    <RegisterForm :initial-code="initialCode" @success="onSuccess" />
    <p class="flex h-[46px] items-center justify-center text-center text-sm text-secondary">
      <span
        >Уже есть аккаунт?
        <RouterLink :to="{ name: 'login' }" class="font-medium text-link hover:underline"
          >Войти</RouterLink
        ></span
      >
    </p>
  </UiCard>
</template>
