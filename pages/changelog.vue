<script setup lang="ts">
import { formatDate } from '~/utils/format'

const { data: entries } = await useAsyncData('changelog-list', () =>
  queryCollection('changelog').order('publishedAt', 'DESC').all(),
)

useSeoMeta({
  title: '更新日志',
  description: 'Subtitle Group Site 的站点更新日志。',
})
</script>

<template>
  <section class="grid gap-6">
    <SectionHeading
      label="changelog"
      title="站点更新日志"
      summary="用来记录骨架、内容结构、接口协议和前台页面层面的关键变更。"
    />

    <div class="grid gap-6">
      <FramePanel v-for="entry in entries || []" :key="entry.slug">
        <div class="grid gap-4">
          <div class="grid gap-2 border-b border-[var(--sgs-line)] pb-4 md:grid-cols-[1fr_auto] md:items-end">
            <div class="grid gap-2">
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">release note</p>
              <h2 class="brand-display text-2xl font-black uppercase text-balance">{{ entry.title }}</h2>
            </div>
            <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
              {{ formatDate(entry.publishedAt) }}
            </p>
          </div>
          <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ entry.summary }}</p>
          <ContentRenderer :value="entry" class="content-prose" />
        </div>
      </FramePanel>
    </div>
  </section>
</template>

