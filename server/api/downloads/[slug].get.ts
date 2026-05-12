import { getRouterParam, createError } from 'h3'
import { getContentManifest } from '~/server/utils/content-data'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const item = getContentManifest().downloads.find((entry) => entry.slug === slug && entry.status === 'active')

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Download not found',
    })
  }

  return {
    ok: true,
    data: item,
  }
})

