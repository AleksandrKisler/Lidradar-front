<script setup lang="ts">
/**
 * Гостевой layout по макету «Вход»: слева тёмная панель с ценностью
 * продукта, справа карточка формы. На узких экранах панель скрыта.
 */
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-2">
    <aside class="hidden bg-nav text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      <p class="text-xl font-bold tracking-tight">◉ LidRadar</p>
      <div class="max-w-md">
        <p class="text-xs font-semibold tracking-widest text-nav-text uppercase">
          Контроль потерянных возможностей
        </p>
        <p class="mt-4 text-4xl leading-tight font-bold">Замечайте риски. Возвращайте клиентов.</p>
        <p class="mt-4 text-base leading-7 text-nav-text">
          Переписка, причина риска и следующий шаг — в одном рабочем пространстве.
        </p>
        <ul class="mt-8 flex flex-col gap-3 text-sm text-nav-text">
          <li class="flex gap-3">
            <span class="text-brand" aria-hidden="true">●</span>Деньги требуют внимания.
          </li>
          <li class="flex gap-3">
            <span class="text-brand" aria-hidden="true">●</span>Понятные причины вместо догадок.
          </li>
          <li class="flex gap-3">
            <span class="text-brand" aria-hidden="true">●</span>Решение и ответ клиенту остаются за
            вами.
          </li>
        </ul>
      </div>
      <p class="text-sm text-nav-text">LidRadar · Для малого бизнеса</p>
    </aside>
    <main id="main" class="flex items-center justify-center px-5 py-10 md:px-12">
      <div class="w-full max-w-md">
        <p class="mb-8 text-xl font-bold tracking-tight text-ink lg:hidden">◉ LidRadar</p>
        <RouterView />
      </div>
    </main>
  </div>
</template>
