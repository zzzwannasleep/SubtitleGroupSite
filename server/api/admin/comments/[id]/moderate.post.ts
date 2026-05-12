import { getRequestIP, getRouterParam, readBody } from 'h3'
import { apiError, apiOk, statusCodeFromError } from '~/server/utils/api'
import { moderateComment } from '~/server/utils/comments'
import { consumeRateLimit } from '~/server/utils/rate-limit'

const actionToStatus = {
  approve: 'approved',
  reject: 'rejected',
  spam: 'spam',
} as const

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`admin:comments:moderate:${requestIp}`, 30, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'Moderation rate limit reached.')
  }

  const commentId = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isFinite(commentId) || commentId <= 0) {
    return apiError(event, 400, 'INVALID_INPUT', 'Comment id is invalid.')
  }

  const body = await readBody<Record<string, unknown>>(event)
  const action = typeof body?.action === 'string' ? body.action.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!(action in actionToStatus)) {
    return apiError(event, 400, 'INVALID_INPUT', 'Moderation action is invalid.')
  }

  const result = await moderateComment(event, commentId, actionToStatus[action as keyof typeof actionToStatus], note || null)
  if (!result.ok) {
    return apiError(event, statusCodeFromError(result.code), result.code, result.message)
  }

  return apiOk({
    moderated: true,
  })
})
