import type { H3Event } from 'h3'
import { getRequestIP } from 'h3'
import { isPlaceholderValue } from '~/server/utils/crypto'

const LOCAL_DEV_TOKEN = 'dev-turnstile-pass'

export async function verifyTurnstileToken(event: H3Event, token: string) {
  const runtimeConfig = useRuntimeConfig()
  const secretKey = process.env.TURNSTILE_SECRET_KEY || runtimeConfig.turnstileSecretKey

  if (!token.trim()) {
    return false
  }

  if (runtimeConfig.public.deployMode === 'local' && isPlaceholderValue(secretKey)) {
    return token === LOCAL_DEV_TOKEN
  }

  if (!secretKey) {
    return false
  }

  const requestIp = getRequestIP(event, { xForwardedFor: true }) || ''
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: requestIp,
    }),
  })

  if (!response.ok) {
    return false
  }

  const payload = (await response.json()) as {
    success?: boolean
  }

  return Boolean(payload.success)
}
