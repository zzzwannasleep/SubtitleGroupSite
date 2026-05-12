<script setup lang="ts">
import { formatDate } from '~/utils/format'

const route = useRoute()

const { data: download } = await useAsyncData(`download-${route.params.slug}`, async () => {
  const item = await queryCollection('downloads').where('slug', '=', route.params.slug as string).first()
  if (!item || item.status !== 'active') {
    throw createError({ statusCode: 404, statusMessage: 'Download not found' })
  }
  return item
})

const { data: article } = await useAsyncData(`download-article-${route.params.slug}`, async () => {
  if (!download.value?.articleSlug) {
    return null
  }

  return queryCollection('articles')
    .where('slug', '=', download.value.articleSlug)
    .where('draft', '=', false)
    .first()
})

useSeoMeta({
  title: download.value?.title || '下载详情',
  description: download.value?.summary || 'Subtitle Group Site 下载详情。',
})
</script>

<template>
  <article v-if="download" class="grid gap-8">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-5">
        <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-5">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            {{ download.category || 'download' }} / {{ formatDate(download.publishedAt) }}
          </p>
          <h1 class="brand-display text-4xl font-black uppercase text-balance md:text-6xl">{{ download.title }}</h1>
          <p class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty md:text-lg">{{ download.summary }}</p>
        </div>

        <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-3">
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">versions</p>
            <p class="mt-2 text-3xl font-black uppercase">{{ download.versions.length }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">files</p>
            <p class="mt-2 text-3xl font-black uppercase">{{ download.versions.flatMap((version) => version.files).length }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">linked article</p>
            <p class="mt-2 text-lg font-black uppercase text-balance">{{ download.articleSlug || 'none' }}</p>
          </div>
        </div>
      </div>
    </FramePanel>

    <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="grid gap-8">
        <DownloadVersions :versions="download.versions" />

        <FramePanel>
          <ContentRenderer :value="download" class="content-prose" />
        </FramePanel>
      </div>

      <div class="grid gap-6">
        <FramePanel v-if="article">
          <div class="grid gap-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">linked article</p>
            <ArticleCard :article="article" />
          </div>
        </FramePanel>

        <FramePanel tone="accent">
          <div class="grid gap-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">rules</p>
            <ul class="grid gap-3 text-sm text-pretty">
              <li>不做自动选链与健康检查驱动切换</li>
              <li>直接展示全部启用下载来源</li>
              <li>不默认展示 SHA256 等重型校验信息</li>
            </ul>
          </div>
        </FramePanel>
      </div>
    </div>
  </article>
</template>

