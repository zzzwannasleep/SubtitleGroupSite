<template>
  <div class="paper-grid min-h-dvh">
    <SiteHeader />
    <main class="mx-auto flex w-full max-w-[1440px] flex-col gap-16 px-4 pb-16 pt-8 md:px-6 md:pb-24 md:pt-10">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>

