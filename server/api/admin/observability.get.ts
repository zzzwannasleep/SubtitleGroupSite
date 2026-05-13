import { getQuery } from 'h3'
import { apiError, apiOk, parsePositiveInt } from '~/server/utils/api'
import { getCurrentUser } from '~/server/utils/auth'
import { getObservabilitySnapshot } from '~/server/utils/observability'

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event)

  if (!user) {
    return apiError(event, 401, 'UNAUTHORIZED', 'You must be signed in.')
  }

  if (user.role !== 'admin') {
    return apiError(event, 403, 'FORBIDDEN', 'Admin access is required.')
  }

  const query = getQuery(event)

  return apiOk(
    await getObservabilitySnapshot(
      event,
      parsePositiveInt(query.hours, 72, 168),
    ),
  )
})
