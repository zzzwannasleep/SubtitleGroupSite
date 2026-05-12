import { createError, getQuery, getRouterParam } from 'h3'
import { getContentManifest } from '~/server/utils/content-data'
import { resolveOrderedLinks } from '~/utils/downloads'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)
  const fileId = typeof query.fileId === 'string' ? query.fileId.trim() : ''

  if (!slug || !fileId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'fileId is required',
    })
  }

  const download = getContentManifest().downloads.find((item) => item.slug === slug && item.status === 'active')

  if (!download) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Download not found',
    })
  }

  const file = download.versions.flatMap((version) => version.files).find((entry) => entry.id === fileId)

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found',
    })
  }

  return {
    ok: true,
    data: {
      slug,
      fileId,
      items: resolveOrderedLinks(file.links),
    },
  }
})
