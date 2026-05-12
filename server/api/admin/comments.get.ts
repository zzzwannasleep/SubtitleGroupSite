import { getQuery } from 'h3'
import { apiError, apiOk, parsePositiveInt } from '~/server/utils/api'
import { getCurrentUser } from '~/server/utils/auth'
import { commentStatusValues, listAdminComments } from '~/server/utils/comments'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)

  if (!user) {
    return apiError(event, 401, 'UNAUTHORIZED', 'You must be signed in.')
  }

  if (user.role !== 'admin') {
    return apiError(event, 403, 'FORBIDDEN', 'Admin access is required.')
  }

  const query = getQuery(event)
  const rawStatus = typeof query.status === 'string' ? query.status.trim() : 'pending'
  const status = rawStatus === 'all' || commentStatusValues.includes(rawStatus as (typeof commentStatusValues)[number]) ? rawStatus : 'pending'

  return apiOk(
    await listAdminComments(
      event,
      status as 'all' | (typeof commentStatusValues)[number],
      parsePositiveInt(query.page, 1, 999),
      parsePositiveInt(query.pageSize, 25, 50),
    ),
  )
})
