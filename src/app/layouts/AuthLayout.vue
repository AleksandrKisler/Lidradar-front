<script setup lang="ts">
import { UiIcon } from '@/shared/ui'
/**
 * Гостевой layout по Figma «Доступ · Apple HIG» (462:5453, 464:6336, 464:8859):
 * на desktop две равные колонки — обзор продукта слева, форма справа, правовые
 * ссылки в общей нижней строке с подписью продукта (US-M01-01 AC-G11); на
 * планшете и телефоне шапка с брендом, форма, правовые ссылки и обзор продукта под ней.
 */
const benefits = [
  'Деньги требуют внимания.',
  'Понятные причины вместо догадок.',
  'Решение и ответ клиенту остаются за вами.',
]
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas lg:grid lg:grid-cols-2">
    <header class="flex h-18 items-center px-6 md:h-20 md:px-8 lg:hidden">
      <p class="flex items-center gap-2.5 text-xl leading-7 font-semibold text-ink">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
    </header>

    <main
      id="main"
      class="flex flex-col items-center px-4 pt-4 pb-8 md:px-[161px] md:pt-8 md:pb-12 lg:min-h-dvh lg:px-8 lg:py-12 xl:px-[104px]"
    >
      <!-- Desktop: противовес нижней строке правовых ссылок — форма остаётся точно по центру экрана. -->
      <div class="hidden h-[18px] shrink-0 lg:block" aria-hidden="true" />
      <div class="w-full max-w-[512px] lg:my-auto">
        <slot><RouterView /></slot>
      </div>
      <!--
        Desktop (Figma 773:6393 и все кадры 461:5460): правовые ссылки в нижней строке напротив
        «LidRadar · Для малого бизнеса» — 64 px от правого края, 24 px между ссылками, ширина по тексту.
        Планшет и телефон: под формой, как в адаптивных кадрах.
      -->
      <nav
        class="mt-6 flex w-full max-w-[512px] flex-col items-center gap-2 text-xs leading-[18px] text-link md:flex-row md:gap-6 lg:mt-0 lg:mr-8 lg:w-auto lg:max-w-none lg:self-end xl:-mr-10"
        aria-label="Юридические документы"
        data-testid="auth-legal"
      >
        <a
          href="/legal/terms.html"
          target="_blank"
          rel="noopener"
          class="flex h-[46px] w-full items-center justify-center text-center hover:underline md:flex-1 lg:h-auto lg:w-auto lg:flex-none"
          >Пользовательское соглашение</a
        >
        <a
          href="/legal/privacy.html"
          target="_blank"
          rel="noopener"
          class="flex h-[46px] w-full items-center justify-center text-center hover:underline md:flex-1 lg:h-auto lg:w-auto lg:flex-none"
          >Политика конфиденциальности</a
        >
      </nav>
    </main>

    <aside
      class="flex flex-col gap-6 bg-panel px-6 py-8 max-lg:flex-1 md:px-24 md:py-12 lg:order-first lg:min-h-dvh lg:justify-between lg:gap-0 lg:px-16"
    >
      <p class="hidden items-center gap-2.5 text-xl leading-7 font-semibold text-ink lg:flex">
        <UiIcon name="radar" class="size-7" />LidRadar
      </p>
      <div class="flex max-w-[592px] flex-col gap-6 md:max-w-[642px] lg:max-w-[592px]">
        <div class="flex flex-col gap-3">
          <p class="text-meta font-medium text-secondary">Контроль потерянных возможностей</p>
          <p
            class="text-[24px] leading-[30px] font-semibold text-ink md:text-4xl md:leading-10 lg:text-display lg:leading-12"
          >
            Замечайте риски.<br />Возвращайте клиентов.
          </p>
        </div>
        <p class="text-sm text-secondary md:text-note lg:text-[17px] lg:leading-[25px]">
          Переписка, причина риска и следующий шаг — в одном рабочем пространстве.
        </p>
        <ul class="flex flex-col gap-3 text-sm text-secondary md:text-note">
          <li v-for="benefit in benefits" :key="benefit" class="flex items-center gap-3">
            <span class="w-3 text-xs leading-[18px] font-medium text-brand" aria-hidden="true"
              >●</span
            >{{ benefit }}
          </li>
        </ul>
      </div>
      <p class="text-xs text-secondary" data-testid="auth-product-line">
        LidRadar · Для малого бизнеса
      </p>
    </aside>
  </div>
</template>
