import { getQuery, getRequestIP } from 'h3'
import { apiError } from '~/server/utils/api'
import { handleGithubCallback } from '~/server/utils/auth'
import { consumeRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`auth:github:callback:${requestIp}`, 20, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'GitHub login rate limit reached.')
  }

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code.trim() : ''
  const state = typeof query.state === 'string' ? query.state.trim() : ''

  if (!code || !state) {
    return apiError(event, 400, 'OAUTH_STATE_INVALID', 'GitHub callback parameters are incomplete.')
  }

  try {
    const handled = await handleGithubCallback(event, code, state)
    if (!handled) {
      return apiError(event, 400, 'OAUTH_STATE_INVALID', 'GitHub state validation failed.')
    }

    return
  } catch (error) {
    console.error(error)
    return apiError(event, 500, 'INTERNAL_ERROR', 'GitHub login failed.')
  }
})
