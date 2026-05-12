<script setup lang="ts">
import { formatDate } from '~/utils/format'

const route = useRoute()

const { data: article } = await useAsyncData(`article-${route.params.slug}`, async () => {
  const item = await queryCollection('articles').where('slug', '=', route.params.slug as string).first()
  if (!item || item.draft) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }
  return item
})

const { data: relatedDownloads } = await useAsyncData(`article-related-${route.params.slug}`, async () => {
  if (!article.value?.relatedDownloads?.length) {
    return []
  }

  return queryCollection('downloads')
    .where('slug', 'IN', article.value.relatedDownloads)
    .where('status', '=', 'active')
    .all()
})

useSeoMeta({
  title: article.value?.seo?.title || article.value?.title || '文章详情',
  description: article.value?.seo?.description || article.value?.summary || 'Subtitle Group Site 文章详情。',
})
</script>

<template>
  <article v-if="article" class="grid gap-8">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-6">
        <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-5">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            {{ article.category || 'article' }} / {{ formatDate(article.publishedAt) }}
          </p>
          <h1 class="brand-display text-4xl font-black uppercase text-balance md:text-6xl">{{ article.title }}</h1>
          <p class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty md:text-lg">{{ article.summary }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <span
            v-for="tag in article.tags || []"
            :key="tag"
            class="brand-mono border border-[var(--sgs-line-strong)] px-2 py-1 text-xs font-semibold uppercase tabular-nums"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </FramePanel>

    <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <FramePanel>
        <ContentRenderer :value="article" class="content-prose" />
      </FramePanel>

      <div class="grid gap-6">
        <CommentPanel :article-slug="article.slug" />

        <FramePanel v-if="relatedDownloads?.length">
          <div class="grid gap-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">related downloads</p>
            <DownloadCard
              v-for="download in relatedDownloads"
              :key="download.slug"
              :download="download"
            />
          </div>
        </FramePanel>
      </div>
    </div>
  </article>
</template>
