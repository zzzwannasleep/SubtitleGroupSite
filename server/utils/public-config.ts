import { isPlaceholderValue } from '~/server/utils/crypto'

export function getPublicRuntimeConfig() {
  const runtimeConfig = useRuntimeConfig()
  const siteBaseUrl = process.env.SITE_BASE_URL || runtimeConfig.public.siteBaseUrl || 'http://127.0.0.1:3000'
  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID || runtimeConfig.githubOauthClientId || ''
  const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || runtimeConfig.githubOauthClientSecret || ''
  const telegramBotName = process.env.TELEGRAM_BOT_NAME || runtimeConfig.telegramBotName || ''
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || runtimeConfig.telegramBotToken || ''
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || runtimeConfig.public.turnstileSiteKey || ''
  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY || runtimeConfig.turnstileSecretKey || ''

  const githubAvailable = !isPlaceholderValue(githubClientId) && !isPlaceholderValue(githubClientSecret)
  const telegramAvailable = !isPlaceholderValue(telegramBotName) && !isPlaceholderValue(telegramBotToken)
  const turnstileConfigured = !isPlaceholderValue(turnstileSiteKey) && !isPlaceholderValue(turnstileSecretKey)

  return {
    siteBaseUrl,
    auth: {
      githubAvailable,
      telegramAvailable,
      telegramBotName: telegramAvailable ? telegramBotName : '',
    },
    turnstile: {
      configured: turnstileConfigured,
      siteKey: turnstileConfigured ? turnstileSiteKey : '',
    },
  }
}
