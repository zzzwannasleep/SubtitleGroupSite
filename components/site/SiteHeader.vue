<script setup lang="ts">
const appConfig = useAppConfig()
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-[var(--sgs-line-strong)] bg-[color:var(--sgs-canvas)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
    <div class="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div class="flex flex-col gap-2">
          <NuxtLink to="/" class="brand-display text-2xl font-black uppercase text-balance">
            Subtitle Group Site
          </NuxtLink>
          <p class="max-w-2xl text-sm text-[color:var(--sgs-muted)] text-pretty">
            内容发布、下载分发、搜索与评论都按同一条结构化主链推进。
          </p>
        </div>
        <div class="grid gap-3">
          <SearchForm variant="header" />
          <AuthActions mode="compact" />
        </div>
      </div>

      <nav class="grid grid-cols-2 gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-6">
        <NuxtLink
          v-for="item in appConfig.navigation"
          :key="item.to"
          :to="item.to"
          class="bg-[color:var(--sgs-panel)] px-3 py-3 text-center text-sm font-semibold text-pretty hover:bg-[color:var(--sgs-accent-soft)]"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
