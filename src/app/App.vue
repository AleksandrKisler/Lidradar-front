<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
    >К основному содержимому</a
  >
  <div class="min-h-screen md:grid md:grid-cols-[240px_1fr]">
    <aside class="bg-slate-950 p-6 text-white">
      <p class="text-2xl font-bold">◉ LidRadar</p>
      <nav aria-label="Главная навигация" class="mt-6 md:mt-12">
        <RouterLink
          to="/"
          class="block rounded-xl bg-slate-800 px-4 py-3 font-medium"
          active-class="border-l-4 border-indigo-400"
          >Radar</RouterLink
        >
      </nav>
    </aside>
    <main id="main" class="mx-auto w-full max-w-6xl p-5 md:p-10"><RouterView /></main>
  </div>
</template>
