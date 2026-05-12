<script setup lang="ts">
import { cn } from '~/utils/cn'

const props = withDefaults(
  defineProps<{
    initialValue?: string
    variant?: 'hero' | 'header'
  }>(),
  {
    initialValue: '',
    variant: 'hero',
  },
)

const keyword = ref(props.initialValue)

watch(
  () => props.initialValue,
  (value) => {
    keyword.value = value
  },
)

async function submit() {
  await navigateTo({
    path: '/search',
    query: keyword.value.trim() ? { q: keyword.value.trim(), type: 'all', page: '1' } : {},
  })
}
</script>

<template>
  <form
    class="grid gap-px border border-[var(--sgs-line-strong)] bg-[color:var(--sgs-line-strong)]"
    :class="cn(props.variant === 'hero' ? 'md:grid-cols-[1fr_180px]' : 'md:w-[420px] md:grid-cols-[1fr_120px]')"
    @submit.prevent="submit"
  >
    <label class="bg-[color:var(--sgs-panel)] px-4 py-3">
      <span class="mb-2 block text-xs font-semibold uppercase text-[color:var(--sgs-muted)]">搜索文章与下载</span>
      <input
        v-model="keyword"
        type="search"
        inputmode="search"
        placeholder="例如：release、windows、workers"
        class="w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-[color:var(--sgs-muted)]"
      >
    </label>
    <button
      type="submit"
      class="bg-[color:var(--sgs-accent)] px-4 py-3 text-sm font-bold uppercase text-[color:var(--sgs-panel)] hover:bg-[color:var(--sgs-ink)]"
    >
      进入搜索
    </button>
  </form>
</template>

