import { getQuery } from 'h3'
import { listDownloadSummaries } from '~/server/utils/downloads'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const tag = typeof query.tag === 'string' ? query.tag.trim() : ''
  const slugs = typeof query.slugs === 'string'
    ? query.slugs.split(',').map((value) => value.trim()).filter(Boolean)
    : []

  return {
    ok: true,
    data: {
      items: listDownloadSummaries({
        tag,
        slugs,
      }),
    },
  }
})
