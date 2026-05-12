<script setup lang="ts">
import { formatBytes } from '~/utils/format'

defineProps<{
  versions: Array<{
    version: string
    label: string
    files: Array<{
      id: string
      name: string
      platform: string
      size: number
      arch?: string | null
      links: Array<{
        id: string
        type: string
        label: string
        order: number
        href: string
      }>
    }>
  }>
}>()
</script>

<template>
  <div class="grid gap-6">
    <FramePanel
      v-for="version in versions"
      :key="version.version"
      tone="muted"
      class="accent-strip"
    >
      <div class="grid gap-5">
        <div class="flex flex-col gap-2 border-b border-[var(--sgs-line)] pb-4 md:flex-row md:items-end md:justify-between">
          <div class="grid gap-2">
            <p class="brand-mono text-xs font-semibold uppercase text-[color:var(--sgs-muted)]">version</p>
            <h3 class="brand-display text-2xl font-black uppercase text-balance">{{ version.version }}</h3>
          </div>
          <p class="text-sm text-[color:var(--sgs-muted)] text-pretty">{{ version.label }}</p>
        </div>

        <div class="grid gap-4">
          <article
            v-for="file in version.files"
            :key="file.id"
            class="grid gap-4 border border-[var(--sgs-line)] bg-[color:var(--sgs-panel)] p-4"
          >
            <div class="grid gap-2 md:grid-cols-[1fr_auto] md:items-start">
              <div class="grid gap-2">
                <h4 class="text-base font-bold text-balance">{{ file.name }}</h4>
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                  {{ file.platform }}<span v-if="file.arch"> / {{ file.arch }}</span> / {{ formatBytes(file.size) }}
                </p>
              </div>
              <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                {{ file.links.length }} sources
              </p>
            </div>

            <div class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)]">
              <div
                v-for="link in file.links"
                :key="`${file.id}-${link.id}`"
                class="grid gap-3 bg-[color:var(--sgs-panel)] px-4 py-3 md:grid-cols-[180px_1fr_auto] md:items-center"
              >
                <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">
                  {{ link.type }}
                </p>
                <p class="text-sm font-semibold text-pretty">{{ link.label }}</p>
                <a
                  :href="link.href"
                  target="_blank"
                  rel="noreferrer"
                  class="text-sm font-bold uppercase text-[color:var(--sgs-accent)] hover:text-[color:var(--sgs-ink)]"
                >
                  鐩存帴涓嬭浇
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </FramePanel>
  </div>
</template>
