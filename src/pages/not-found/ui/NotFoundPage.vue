<script setup lang="ts">
/** Нейтральная страница для неизвестного адреса; не раскрывает структуру приложения. */
</script>

<template>
  <main id="main" class="flex min-h-dvh items-center justify-center p-6">
    <div class="max-w-md text-center">
      <p class="text-xs font-semibold tracking-wide text-muted">Ошибка 404</p>
      <h1 class="mt-2 text-3xl font-bold text-ink">Страница не найдена</h1>
      <p class="mt-3 text-sm text-muted">Проверьте адрес или вернитесь к рабочему пространству.</p>
      <RouterLink
        to="/"
        class="mt-6 inline-flex h-11 items-center rounded-control bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Вернуться в Radar
      </RouterLink>
    </div>
  </main>
</template>
