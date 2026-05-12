import { createError, getQuery, getRouterParam } from 'h3'
import { findActiveDownload, findDownloadFile, serializePublicDownloadLinks } from '~/server/utils/downloads'

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

  const download = findActiveDownload(slug)

  if (!download) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Download not found',
    })
  }

  const file = findDownloadFile(download, fileId)

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
      items: serializePublicDownloadLinks(slug, fileId, file.links),
    },
  }
})
