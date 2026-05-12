import { getRequestIP, getRouterParam, readBody } from 'h3'
import { apiError, apiOk, statusCodeFromError } from '~/server/utils/api'
import { createCommentReport } from '~/server/utils/comments'
import { consumeRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`comments:report:${requestIp}`, 10, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'Comment report rate limit reached.')
  }

  const commentId = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isFinite(commentId) || commentId <= 0) {
    return apiError(event, 400, 'INVALID_INPUT', 'Comment id is invalid.')
  }

  const body = await readBody<Record<string, unknown>>(event)
  const reason = typeof body?.reason === 'string' ? body.reason : ''
  const result = await createCommentReport(event, commentId, reason)

  if (!result.ok) {
    return apiError(event, statusCodeFromError(result.code), result.code, result.message)
  }

  return apiOk({
    reported: true,
  })
})
