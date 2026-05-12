import { getQuery } from 'h3'
import { apiError, apiOk, parsePositiveInt } from '~/server/utils/api'
import { listPublicComments } from '~/server/utils/comments'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const articleSlug = typeof query.articleSlug === 'string' ? query.articleSlug.trim() : ''

  if (!articleSlug) {
    return apiError(event, 400, 'INVALID_INPUT', 'articleSlug is required.')
  }

  return apiOk(
    await listPublicComments(
      event,
      articleSlug,
      parsePositiveInt(query.page, 1, 999),
      parsePositiveInt(query.pageSize, 20, 50),
    ),
  )
})
