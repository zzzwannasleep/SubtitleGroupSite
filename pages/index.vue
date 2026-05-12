<script setup lang="ts">
import { formatCount } from '~/utils/format'

const { data } = await useAsyncData('home-shell', async () => {
  const [articles, downloadsResponse] = await Promise.all([
    queryCollection('articles').where('draft', '=', false).order('publishedAt', 'DESC').all(),
    $fetch('/api/downloads'),
  ])

  return {
    articles,
    downloads: downloadsResponse.data.items,
  }
})

const latestArticles = computed(() => data.value?.articles.slice(0, 2) || [])
const latestDownloads = computed(() => data.value?.downloads.slice(0, 2) || [])

useSeoMeta({
  title: '首页',
  description: 'Subtitle Group Site 的内容与下载一体化骨架首页。',
})
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-8">
        <div class="grid gap-4 border-b border-[var(--sgs-line)] pb-6">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">content / download / search</p>
          <h1 class="brand-display max-w-4xl text-5xl font-black uppercase leading-none text-balance md:text-7xl">
            A Rigid Frontline For Release Notes And Direct Downloads
          </h1>
          <p class="max-w-2xl text-base text-[color:var(--sgs-muted)] text-pretty md:text-lg">
            这个骨架先把文章、下载、搜索三条主链收紧，再继续接入登录、评论、审核与部署闭环。
          </p>
        </div>

        <SearchForm variant="hero" />

        <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-3">
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">public articles</p>
            <p class="mt-3 text-4xl font-black uppercase">{{ formatCount(data?.articles.length || 0) }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">active downloads</p>
            <p class="mt-3 text-4xl font-black uppercase">{{ formatCount(data?.downloads.length || 0) }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">current slice</p>
            <p class="mt-3 text-2xl font-black uppercase text-balance">foundation / schema / search</p>
          </div>
        </div>
      </div>
    </FramePanel>

    <div class="grid gap-6">
      <FramePanel>
        <div class="grid gap-4">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">why this structure</p>
          <h2 class="brand-display text-2xl font-black uppercase text-balance">One system for explanations, artifacts, and lookup</h2>
          <div class="grid gap-3 text-sm text-[color:var(--sgs-muted)] text-pretty">
            <p>文章解释版本和发布变化，下载页承接文件与来源，搜索同时覆盖两类内容。</p>
            <p>首期不追求万能后台，先把访问路径、内容约束和下载展示模型站稳。</p>
          </div>
        </div>
      </FramePanel>

      <FramePanel tone="accent">
        <div class="grid gap-4">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">next chain</p>
          <ul class="grid gap-3 text-sm text-pretty">
            <li>GitHub OAuth 与 Telegram 登录</li>
            <li>Turnstile 校验后的评论提交流程</li>
            <li>管理员审核、删除与封禁后台</li>
          </ul>
        </div>
      </FramePanel>
    </div>
  </section>

  <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
    <div class="grid gap-6">
      <SectionHeading
        label="latest articles"
        title="最近文章"
        summary="公开文章会进入列表与搜索；草稿内容继续保留在内容层，不外露。"
      />
      <div class="grid gap-6">
        <ArticleCard v-for="article in latestArticles" :key="article.slug" :article="article" />
      </div>
    </div>

    <div class="grid gap-6">
      <SectionHeading
        label="active downloads"
        title="最近下载"
        summary="下载页已经按版本、文件和来源三层结构展开，顺序由内容中的 order 控制。"
      />
      <div class="grid gap-6">
        <DownloadCard v-for="download in latestDownloads" :key="download.slug" :download="download" />
      </div>
    </div>
  </section>
</template>
