import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2026-05-12',
  modules: ['@nuxt/content'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    preset: process.env.NITRO_PRESET || undefined,
    externals: {
      trace: false,
    },
    cloudflare: {
      nodeCompat: true,
    },
  },
  devServer: {
    host: process.env.NITRO_HOST || '127.0.0.1',
    port: Number(process.env.NITRO_PORT || 3000),
  },
  routeRules: {
    '/api/search': { swr: 60 },
    '/api/downloads/**': { swr: 120 },
  },
  runtimeConfig: {
    authSessionSecret: process.env.AUTH_SESSION_SECRET,
    turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
    commentBlocklistWords: process.env.COMMENT_BLOCKLIST_WORDS || '',
    githubOauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    githubOauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramBotName: process.env.TELEGRAM_BOT_NAME,
    adminIdentities: process.env.ADMIN_IDENTITIES || '',
    githubToken: process.env.GITHUB_TOKEN,
    webdavUsername: process.env.WEBDAV_USERNAME,
    webdavPassword: process.env.WEBDAV_PASSWORD,
    public: {
      siteBaseUrl: process.env.SITE_BASE_URL || 'http://127.0.0.1:3000',
      deployMode: process.env.DEPLOY_MODE || 'local',
      siteName: 'Subtitle Group Site',
      turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
      telegramBotName: process.env.TELEGRAM_BOT_NAME || '',
      commentRateLimitPerMinute: Number(process.env.COMMENT_RATE_LIMIT_PER_MINUTE || 5),
      localStorageEnable: process.env.LOCAL_STORAGE_ENABLE || 'false',
    },
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN',
      },
      titleTemplate: '%s · Subtitle Group Site',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: '面向字幕组与发行维护者的内容站与下载站一体化骨架。',
        },
      ],
    },
  },
})
