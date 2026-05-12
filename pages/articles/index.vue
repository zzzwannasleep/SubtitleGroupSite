<script setup lang="ts">
const { data: articles } = await useAsyncData('articles-list', () =>
  queryCollection('articles').where('draft', '=', false).order('publishedAt', 'DESC').all(),
)

const tags = computed(() => {
  const allTags = new Set<string>()
  for (const article of articles.value || []) {
    for (const tag of article.tags || []) {
      allTags.add(tag)
    }
  }

  return [...allTags].sort()
})

useSeoMeta({
  title: '文章',
  description: 'Subtitle Group Site 的公开文章列表。',
})
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1fr_320px]">
    <div class="grid gap-6">
      <SectionHeading
        label="articles"
        title="公开文章列表"
        summary="这里展示所有非 draft 文章。它们会进入站内搜索，并且可以关联到下载条目。"
      />
      <div class="grid gap-6 xl:grid-cols-2">
        <ArticleCard v-for="article in articles || []" :key="article.slug" :article="article" />
      </div>
    </div>

    <FramePanel tone="muted">
      <div class="grid gap-4">
        <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">tag archive</p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="tag in tags"
            :key="tag"
            :to="`/tags/${tag}`"
            class="brand-mono border border-[var(--sgs-line-strong)] px-2 py-1 text-xs font-semibold uppercase tabular-nums hover:bg-[color:var(--sgs-accent-soft)]"
          >
            {{ tag }}
          </NuxtLink>
        </div>
      </div>
    </FramePanel>
  </section>
</template>

