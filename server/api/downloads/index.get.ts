import { getContentManifest } from '~/server/utils/content-data'

export default defineEventHandler(() => {
  const items = getContentManifest().downloads
    .filter((item) => item.status === 'active')
    .map((item) => ({
      title: item.title,
      slug: item.slug,
      summary: item.summary,
      category: item.category,
      tags: item.tags,
      publishedAt: item.publishedAt,
      updatedAt: item.updatedAt,
      versions: item.versions.map((version) => version.version),
      url: item.url,
    }))

  return {
    ok: true,
    data: {
      items,
    },
  }
})

