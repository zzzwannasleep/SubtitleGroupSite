<script setup lang="ts">
import { formatDate } from '~/utils/format'

defineProps<{
  download: {
    title: string
    slug: string
    summary: string
    publishedAt: string
    updatedAt?: string | null
    category?: string | null
    tags?: string[]
    versions: Array<string | { version: string }>
  }
}>()
</script>

<template>
  <FramePanel class="h-full accent-strip">
    <div class="grid h-full gap-5">
      <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-4">
        <div class="flex items-start justify-between gap-4">
          <div class="grid gap-2">
            <p class="brand-mono text-xs font-semibold uppercase text-[color:var(--sgs-muted)]">
              {{ download.category || 'download' }}
            </p>
            <NuxtLink
              :to="`/downloads/${download.slug}`"
              class="brand-display text-2xl font-black uppercase text-balance hover:text-[color:var(--sgs-accent)]"
            >
              {{ download.title }}
            </NuxtLink>
          </div>
          <div class="brand-mono text-right text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
            <p>{{ formatDate(download.publishedAt) }}</p>
            <p v-if="download.updatedAt">更新 {{ formatDate(download.updatedAt) }}</p>
          </div>
        </div>
        <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ download.summary }}</p>
      </div>

      <div class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="tag in download.tags || []"
            :key="tag"
            class="brand-mono border border-[var(--sgs-line-strong)] px-2 py-1 text-xs font-semibold uppercase tabular-nums"
          >
            {{ tag }}
          </span>
        </div>
        <div class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
          {{ download.versions.length }} version<span v-if="download.versions.length > 1">s</span>
        </div>
      </div>
    </div>
  </FramePanel>
</template>

