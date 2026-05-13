import { getRequestIP, readBody } from 'h3'
import { apiError, apiOk, statusCodeFromError } from '~/server/utils/api'
import { getCurrentUser } from '~/server/utils/auth'
import { createComment } from '~/server/utils/comments'
import { recordCommentFailure } from '~/server/utils/observability'
import { consumeRateLimit } from '~/server/utils/rate-limit'
import { verifyTurnstileToken } from '~/server/utils/turnstile'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`comments:create:${requestIp}`, 10, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'Comment submission rate limit reached.')
  }

  const body = await readBody<Record<string, unknown>>(event)
  const articleSlug = typeof body?.articleSlug === 'string' ? body.articleSlug.trim() : ''
  const commentBody = typeof body?.body === 'string' ? body.body : ''
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : ''
  const currentUser = await getCurrentUser(event)

  async function fail(statusCode: number, code: Parameters<typeof apiError>[2], message: string) {
    await recordCommentFailure(event, {
      articleSlug: articleSlug || null,
      userId: currentUser?.id || null,
      authenticated: Boolean(currentUser),
      errorCode: code,
      errorMessage: message,
    })

    return apiError(event, statusCode, code, message)
  }

  if (!articleSlug || !commentBody) {
    return fail(400, 'INVALID_INPUT', 'articleSlug and body are required.')
  }

  if (!(await verifyTurnstileToken(event, turnstileToken))) {
    return fail(400, 'TURNSTILE_FAILED', 'Turnstile validation failed.')
  }

  const result = await createComment(event, articleSlug, commentBody, {
    currentUser,
  })
  if (!result.ok) {
    return fail(statusCodeFromError(result.code), result.code, result.message)
  }

  return apiOk({
    status: result.status,
    message: result.message,
  })
})
