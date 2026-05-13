<script setup lang="ts">
const route = useRoute()

const links = [
  { label: 'Review Desk', to: '/admin/comments' },
  { label: 'Ops Board', to: '/admin/operations' },
]
</script>

<template>
  <nav class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)] md:grid-cols-2">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="px-4 py-3 text-center text-sm font-semibold uppercase"
      :class="route.path === link.to ? 'bg-[color:var(--sgs-accent)] text-[color:var(--sgs-panel)]' : 'bg-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-accent-soft)]'"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
