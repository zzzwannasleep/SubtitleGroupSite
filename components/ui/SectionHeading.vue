<script setup lang="ts">
defineProps<{
  label: string
  title: string
  summary?: string
}>()
</script>

<template>
  <div class="grid gap-3 border-b border-[var(--sgs-line)] pb-5">
    <p class="brand-mono text-xs font-semibold uppercase tabular-nums text-[color:var(--sgs-muted)]">{{ label }}</p>
    <h2 class="brand-display text-3xl font-black uppercase text-balance md:text-4xl">
      {{ title }}
    </h2>
    <p v-if="summary" class="max-w-3xl text-base text-[color:var(--sgs-muted)] text-pretty">
      {{ summary }}
    </p>
  </div>
</template>

