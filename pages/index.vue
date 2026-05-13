<script setup lang="ts">
import { formatCount } from '~/utils/format'

const { data } = await useAsyncData('home-shell', async () => {
  const [articles, downloadsResponse, latestChangelog] = await Promise.all([
    queryCollection('articles').where('draft', '=', false).order('publishedAt', 'DESC').all(),
    $fetch('/api/downloads'),
    queryCollection('changelog').order('publishedAt', 'DESC').first(),
  ])

  return {
    articles,
    downloads: downloadsResponse.data.items,
    latestChangelog,
  }
})

const latestArticles = computed(() => data.value?.articles.slice(0, 2) || [])
const latestDownloads = computed(() => data.value?.downloads.slice(0, 2) || [])

useSeoMeta({
  title: 'Home',
  description: 'Subtitle Group Site unifies articles, downloads, search, authentication, comments, and observability in one release-grade surface.',
})
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-8">
        <div class="grid gap-4 border-b border-[var(--sgs-line)] pb-6">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            release desk / content index / download board
          </p>
          <h1 class="brand-display max-w-4xl text-5xl font-black uppercase leading-none text-balance md:text-7xl">
            One Hard-Edged Surface For Notes, Files, Search, And Moderation
          </h1>
          <p class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty md:text-lg">
            The current build already closes the main public chain: content publishing, searchable archives, tracked download delivery, third-party login, moderated comments, and an operations board for telemetry.
          </p>
        </div>

        <SearchForm variant="hero" />

        <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-[1.1fr_1.1fr_0.8fr]">
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">public articles</p>
            <p class="mt-3 text-4xl font-black uppercase tabular-nums">{{ formatCount(data?.articles.length || 0) }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">active downloads</p>
            <p class="mt-3 text-4xl font-black uppercase tabular-nums">{{ formatCount(data?.downloads.length || 0) }}</p>
          </div>
          <div class="bg-[color:var(--sgs-panel)] p-4">
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">current cut</p>
            <p class="mt-3 text-xl font-black uppercase text-balance">ops / auth / comments</p>
          </div>
        </div>
      </div>
    </FramePanel>

    <div class="grid gap-6">
      <FramePanel>
        <div class="grid gap-4">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">system lanes</p>
          <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)]">
            <div class="grid gap-2 bg-[color:var(--sgs-panel)] p-4">
              <p class="text-sm font-semibold uppercase">Content + Search</p>
              <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">Articles and downloads share one index, one result page, and one schema-driven publishing flow.</p>
            </div>
            <div class="grid gap-2 bg-[color:var(--sgs-panel)] p-4">
              <p class="text-sm font-semibold uppercase">Auth + Comments</p>
              <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">GitHub and Telegram login feed a site session, then pass through Turnstile and moderation gates.</p>
            </div>
            <div class="grid gap-2 bg-[color:var(--sgs-panel)] p-4">
              <p class="text-sm font-semibold uppercase">Delivery + Ops</p>
              <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">Tracked download access now sits beside search request telemetry and comment failure diagnostics.</p>
            </div>
          </div>
        </div>
      </FramePanel>

      <FramePanel tone="accent">
        <div class="grid gap-4">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">latest changelog</p>
          <div v-if="data?.latestChangelog" class="grid gap-3">
            <NuxtLink
              to="/changelog"
              class="brand-display text-2xl font-black uppercase text-balance hover:text-[color:var(--sgs-accent)]"
            >
              {{ data.latestChangelog.title }}
            </NuxtLink>
            <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ data.latestChangelog.summary }}</p>
          </div>
          <p v-else class="text-sm text-[color:var(--sgs-muted)] text-pretty">
            No changelog cut has been published yet.
          </p>
        </div>
      </FramePanel>
    </div>
  </section>

  <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
    <div class="grid gap-6">
      <SectionHeading
        label="latest articles"
        title="Recent Release Notes"
        summary="Public articles stay in the searchable archive and can cross-link into install packages, version tracks, and delivery notes."
      />
      <div class="grid gap-6">
        <ArticleCard v-for="article in latestArticles" :key="article.slug" :article="article" />
      </div>
    </div>

    <div class="grid gap-6">
      <SectionHeading
        label="active downloads"
        title="Recent Delivery Entries"
        summary="Download records expand by version, by file, and by tracked source. Ordering still follows content-declared priority rather than runtime auto-selection."
      />
      <div class="grid gap-6">
        <DownloadCard v-for="download in latestDownloads" :key="download.slug" :download="download" />
      </div>
    </div>
  </section>
</template>
