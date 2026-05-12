import { getRequestIP, readBody } from 'h3'
import { apiError, apiOk } from '~/server/utils/api'
import { handleTelegramLogin, verifyTelegramPayload } from '~/server/utils/auth'
import { consumeRateLimit } from '~/server/utils/rate-limit'

export default defineEventHandler(async (event) => {
  const requestIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rateLimit = consumeRateLimit(`auth:telegram:verify:${requestIp}`, 20, 60_000)

  if (!rateLimit.ok) {
    return apiError(event, 429, 'RATE_LIMITED', 'Telegram login rate limit reached.')
  }

  const body = await readBody<Record<string, unknown>>(event)

  if (!body || !body.id || !body.auth_date || typeof body.hash !== 'string') {
    return apiError(event, 400, 'INVALID_INPUT', 'Telegram login payload is incomplete.')
  }

  try {
    const payload = {
      id: body.id,
      first_name: typeof body.first_name === 'string' ? body.first_name : undefined,
      last_name: typeof body.last_name === 'string' ? body.last_name : undefined,
      username: typeof body.username === 'string' ? body.username : undefined,
      photo_url: typeof body.photo_url === 'string' ? body.photo_url : undefined,
      auth_date: body.auth_date,
      hash: body.hash,
    }

    const verified = await verifyTelegramPayload(payload)
    if (!verified) {
      return apiError(event, 400, 'TELEGRAM_SIGNATURE_INVALID', 'Telegram signature validation failed.')
    }

    const user = await handleTelegramLogin(event, payload)
    return apiOk({
      authenticated: true,
      user,
    })
  } catch (error) {
    console.error(error)
    return apiError(event, 500, 'INTERNAL_ERROR', 'Telegram login failed.')
  }
})
