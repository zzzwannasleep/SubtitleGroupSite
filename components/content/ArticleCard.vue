<script setup lang="ts">
import { formatDate } from '~/utils/format'

defineProps<{
  article: {
    title: string
    slug: string
    summary: string
    publishedAt: string
    updatedAt?: string | null
    category?: string | null
    tags?: string[]
  }
}>()
</script>

<template>
  <FramePanel class="h-full">
    <div class="grid h-full gap-5">
      <div class="flex items-start justify-between gap-4 border-b border-[var(--sgs-line)] pb-4">
        <div class="grid gap-2">
          <p class="brand-mono text-xs font-semibold uppercase text-[color:var(--sgs-muted)]">
            {{ article.category || 'article' }}
          </p>
          <NuxtLink
            :to="`/articles/${article.slug}`"
            class="brand-display text-2xl font-black uppercase text-balance hover:text-[color:var(--sgs-accent)]"
          >
            {{ article.title }}
          </NuxtLink>
        </div>
        <div class="brand-mono text-right text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
          <p>{{ formatDate(article.publishedAt) }}</p>
          <p v-if="article.updatedAt">更新 {{ formatDate(article.updatedAt) }}</p>
        </div>
      </div>

      <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ article.summary }}</p>

      <div class="mt-auto flex flex-wrap gap-2 border-t border-[var(--sgs-line)] pt-4">
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
</template>

