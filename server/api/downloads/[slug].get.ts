import { createError, getRouterParam } from 'h3'
import { serializeDownloadDetail } from '~/server/utils/downloads'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const item = await queryCollection(event, 'downloads').where('slug', '=', slug as string).first()

  if (!item || item.status !== 'active') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Download not found',
    })
  }

  return {
    ok: true,
    data: serializeDownloadDetail(item),
  }
})
