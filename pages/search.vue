<script setup lang="ts">
import { formatDate } from '~/utils/format'
import { highlightText } from '~/utils/search'

const route = useRoute()

const searchQuery = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const type = computed(() => {
  const value = typeof route.query.type === 'string' ? route.query.type : 'all'
  return ['all', 'articles', 'downloads'].includes(value) ? value : 'all'
})
const page = computed(() => {
  const raw = Number.parseInt(typeof route.query.page === 'string' ? route.query.page : '1', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
})
const pageSize = computed(() => {
  const raw = Number.parseInt(typeof route.query.pageSize === 'string' ? route.query.pageSize : '12', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 12
})

const { data, pending } = await useFetch('/api/search', {
  key: () => `search:${searchQuery.value}:${type.value}:${page.value}:${pageSize.value}`,
  query: computed(() => ({
    q: searchQuery.value,
    type: type.value,
    page: String(page.value),
    pageSize: String(pageSize.value),
  })),
  default: () => ({
    ok: true,
    data: {
      q: '',
      type: 'all',
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 0,
      items: [],
    },
  }),
})

const payload = computed(() => data.value?.data)

const pageLinks = computed(() => {
  const totalPages = payload.value?.totalPages || 0
  return Array.from({ length: totalPages }, (_, index) => index + 1)
})

function queryFor(nextType: string, nextPage = 1) {
  return {
    q: searchQuery.value,
    type: nextType,
    page: String(nextPage),
    pageSize: String(pageSize.value),
  }
}

useSeoMeta({
  title: searchQuery.value ? `搜索 ${searchQuery.value}` : '搜索',
  description: 'Subtitle Group Site 的搜索结果页。',
})
</script>

<template>
  <section class="grid gap-6">
    <FramePanel tone="muted" class="accent-strip">
      <div class="grid gap-6">
        <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-5">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">search</p>
          <h1 class="brand-display text-4xl font-black uppercase text-balance md:text-6xl">Search Across Articles And Downloads</h1>
          <p class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty">
            标题命中优先，其次是标签、摘要、版本号和文件名。空关键词不会触发重逻辑。
          </p>
        </div>

        <SearchForm :initial-value="searchQuery" variant="hero" />

        <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-3">
          <NuxtLink
            v-for="entry in [
              { key: 'all', label: '全部' },
              { key: 'articles', label: '文章' },
              { key: 'downloads', label: '下载' }
            ]"
            :key="entry.key"
            :to="{ path: '/search', query: queryFor(entry.key) }"
            class="px-4 py-3 text-center text-sm font-bold uppercase"
            :class="type === entry.key ? 'bg-[color:var(--sgs-accent)] text-[color:var(--sgs-panel)]' : 'bg-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-accent-soft)]'"
          >
            {{ entry.label }}
          </NuxtLink>
        </div>
      </div>
    </FramePanel>

    <FramePanel v-if="pending">
      <p class="text-sm text-[color:var(--sgs-muted)]">正在生成结果视图…</p>
    </FramePanel>

    <template v-else>
      <FramePanel v-if="!payload?.items.length">
        <div class="grid gap-3">
          <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">empty result</p>
          <h2 class="brand-display text-2xl font-black uppercase text-balance">没有找到匹配项</h2>
          <p class="max-w-2xl text-sm text-[color:var(--sgs-muted)] text-pretty">
            试试更短的关键词、切换到特定类型，或者直接回到文章与下载列表继续浏览。
          </p>
          <div class="flex flex-wrap gap-3">
            <NuxtLink to="/articles" class="text-sm font-bold uppercase text-[color:var(--sgs-accent)] hover:text-[color:var(--sgs-ink)]">
              浏览文章
            </NuxtLink>
            <NuxtLink to="/downloads" class="text-sm font-bold uppercase text-[color:var(--sgs-accent)] hover:text-[color:var(--sgs-ink)]">
              浏览下载
            </NuxtLink>
          </div>
        </div>
      </FramePanel>

      <template v-else>
        <div class="grid gap-6">
          <FramePanel>
            <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div class="grid gap-2">
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">result overview</p>
                <h2 class="brand-display text-2xl font-black uppercase text-balance">
                  {{ payload.total }} result<span v-if="payload.total !== 1">s</span> for “{{ payload.q }}”
                </h2>
              </div>
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                page {{ payload.page }} / {{ payload.totalPages }}
              </p>
            </div>
          </FramePanel>

          <div class="grid gap-4">
            <FramePanel
              v-for="item in payload.items"
              :key="`${item.kind}-${item.slug}`"
              class="accent-strip"
            >
              <div class="grid gap-4">
                <div class="flex flex-col gap-3 border-b border-[var(--sgs-line)] pb-4 md:flex-row md:items-start md:justify-between">
                  <div class="grid gap-2">
                    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">{{ item.kind }}</p>
                    <NuxtLink :to="item.url" class="brand-display text-2xl font-black uppercase text-balance hover:text-[color:var(--sgs-accent)]">
                      {{ item.title }}
                    </NuxtLink>
                  </div>
                  <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                    {{ formatDate(item.updatedAt || item.publishedAt) }}
                  </p>
                </div>

                <p class="text-sm text-[color:var(--sgs-muted)] text-pretty" v-html="highlightText(item.summary, payload.q)" />

                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in item.tags"
                    :key="tag"
                    class="brand-mono border border-[var(--sgs-line-strong)] px-2 py-1 text-xs font-semibold uppercase tabular-nums"
                    v-html="highlightText(tag, payload.q)"
                  />
                </div>

                <div
                  v-if="item.kind === 'download' && ((item.matchedVersions && item.matchedVersions.length) || (item.matchedFiles && item.matchedFiles.length))"
                  class="grid gap-2 border-t border-[var(--sgs-line)] pt-4 text-sm text-[color:var(--sgs-muted)]"
                >
                  <p v-if="item.matchedVersions?.length" class="text-pretty">
                    命中版本：{{ item.matchedVersions.join(' / ') }}
                  </p>
                  <p v-if="item.matchedFiles?.length" class="text-pretty">
                    命中文件：{{ item.matchedFiles.join(' / ') }}
                  </p>
                </div>
              </div>
            </FramePanel>
          </div>

          <nav v-if="payload.totalPages > 1" class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-6">
            <NuxtLink
              v-for="pageNumber in pageLinks"
              :key="pageNumber"
              :to="{ path: '/search', query: queryFor(type, pageNumber) }"
              class="px-4 py-3 text-center text-sm font-bold uppercase"
              :class="payload.page === pageNumber ? 'bg-[color:var(--sgs-accent)] text-[color:var(--sgs-panel)]' : 'bg-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-accent-soft)]'"
            >
              {{ pageNumber }}
            </NuxtLink>
          </nav>
        </div>
      </template>
    </template>
  </section>
</template>

