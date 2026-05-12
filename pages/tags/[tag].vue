<script setup lang="ts">
const route = useRoute()
const tag = computed(() => route.params.tag as string)

const { data } = await useAsyncData(`tag-${tag.value}`, async () => {
  const [articles, downloads] = await Promise.all([
    queryCollection('articles').where('draft', '=', false).where('tags', 'LIKE', `%${tag.value}%`).all(),
    queryCollection('downloads').where('status', '=', 'active').where('tags', 'LIKE', `%${tag.value}%`).all(),
  ])

  return { articles, downloads }
})

useSeoMeta({
  title: `${tag.value} 标签`,
  description: `标签 ${tag.value} 的文章与下载集合。`,
})
</script>

<template>
  <section class="grid gap-8">
    <SectionHeading
      :label="`tag / ${tag}`"
      :title="`标签：${tag}`"
      summary="标签页同时归档文章与下载条目，便于在同一主题下交叉查看说明与资源。"
    />

    <div class="grid gap-8 xl:grid-cols-2">
      <div class="grid gap-6">
        <h2 class="brand-display text-2xl font-black uppercase text-balance">相关文章</h2>
        <ArticleCard v-for="article in data?.articles || []" :key="article.slug" :article="article" />
      </div>
      <div class="grid gap-6">
        <h2 class="brand-display text-2xl font-black uppercase text-balance">相关下载</h2>
        <DownloadCard v-for="download in data?.downloads || []" :key="download.slug" :download="download" />
      </div>
    </div>
  </section>
</template>

