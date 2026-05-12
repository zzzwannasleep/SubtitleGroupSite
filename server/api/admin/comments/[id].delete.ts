import { getRequestIP, getRouterParam, readBody } from 'h3'
import { apiError, apiOk, statusCodeFromError } from '~/server/utils/api'
import { deleteCommentByAdmin } from '~/server/utils/comments'
import { consumeRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`admin:comments:delete:${requestIp}`, 30, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'Deletion rate limit reached.')
  }

  const commentId = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isFinite(commentId) || commentId <= 0) {
    return apiError(event, 400, 'INVALID_INPUT', 'Comment id is invalid.')
  }

  const body = await readBody<Record<string, unknown>>(event).catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const result = await deleteCommentByAdmin(event, commentId, note || null)

  if (!result.ok) {
    return apiError(event, statusCodeFromError(result.code), result.code, result.message)
  }

  return apiOk({
    deleted: true,
  })
})
