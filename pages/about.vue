<script setup lang="ts">
const { data: page } = await useAsyncData('page-about', async () => {
  const item = await queryCollection('pages').where('slug', '=', 'about').first()
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'About page not found' })
  }
  return item
})

useSeoMeta({
  title: page.value?.seo?.title || page.value?.title || '关于',
  description: page.value?.seo?.description || page.value?.summary || '关于 Subtitle Group Site。',
})
</script>

<template>
  <section v-if="page" class="grid gap-6">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-5">
        <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">about</p>
        <h1 class="brand-display text-4xl font-black uppercase text-balance md:text-6xl">{{ page.title }}</h1>
        <p class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty md:text-lg">{{ page.summary }}</p>
      </div>
    </FramePanel>

    <FramePanel>
      <ContentRenderer :value="page" class="content-prose" />
    </FramePanel>
  </section>
</template>

