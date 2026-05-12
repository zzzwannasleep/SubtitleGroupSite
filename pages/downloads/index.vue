<script setup lang="ts">
const { data: downloads } = await useAsyncData('downloads-list', () =>
  queryCollection('downloads').where('status', '=', 'active').order('publishedAt', 'DESC').all(),
)

useSeoMeta({
  title: '下载',
  description: 'Subtitle Group Site 的公开下载列表。',
})
</script>

<template>
  <section class="grid gap-6">
    <SectionHeading
      label="downloads"
      title="公开下载列表"
      summary="条目以版本、文件和来源三层结构存储；页面按声明顺序展示版本，按 order 倒序展示来源。"
    />

    <div class="grid gap-6 xl:grid-cols-2">
      <DownloadCard v-for="download in downloads || []" :key="download.slug" :download="download" />
    </div>
  </section>
</template>

