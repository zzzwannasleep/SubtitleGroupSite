import { getRequestIP, sendRedirect } from 'h3'
import { apiError } from '~/server/utils/api'
import { getGithubAuthorizationUrl } from '~/server/utils/auth'
import { consumeRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`auth:github:start:${requestIp}`, 20, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'GitHub login rate limit reached.')
  }

  try {
    return await sendRedirect(event, await getGithubAuthorizationUrl(event))
  } catch (error) {
    console.error(error)
    return apiError(event, 500, 'INTERNAL_ERROR', 'GitHub login is not configured yet.')
  }
})
