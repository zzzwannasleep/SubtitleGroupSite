import type { H3Event } from 'h3'
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  getRequestURL,
  sendRedirect,
  setCookie,
} from 'h3'
import { createRandomToken, hmacSha256Hex, isPlaceholderValue } from '~/server/utils/crypto'
import { useDatabase } from '~/server/utils/database'
import { getPublicRuntimeConfig } from '~/server/utils/public-config'

const SESSION_COOKIE = 'sgs_session'
const GITHUB_STATE_COOKIE = 'sgs_github_state'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const TELEGRAM_MAX_AGE_SECONDS = 60 * 60 * 24

export type SessionUser = {
  id: number
  provider: 'github' | 'telegram'
  providerUserId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  email: string | null
  role: 'user' | 'admin'
  commentBanned: boolean
}

type SessionRow = {
  sessionId: number
  expiresAt: string
  id: number
  provider: 'github' | 'telegram'
  providerUserId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  email: string | null
  role: 'user' | 'admin'
  commentBanned: number
}

type UserRow = Omit<SessionRow, 'sessionId' | 'expiresAt'>

type UpsertProviderUserInput = {
  provider: 'github' | 'telegram'
  providerUserId: string
  username: string | null
  displayName: string
  avatarUrl: string | null
  email: string | null
}

type GithubProfile = {
  id: number
  login: string
  name?: string | null
  avatar_url?: string | null
  email?: string | null
}

export type TelegramPayload = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

function getNowIso() {
  return new Date().toISOString()
}

function getRuntimeEnv(name: string, fallback?: string | null) {
  return process.env[name] || fallback || ''
}

function getCookieOptions(event: H3Event, maxAge: number) {
  const requestUrl = getRequestURL(event)
  const secure = requestUrl.protocol === 'https:' || getPublicRuntimeConfig().siteBaseUrl.startsWith('https://')

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge,
  }
}

function mapUserRow(row: UserRow): SessionUser {
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.providerUserId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    email: row.email,
    role: row.role,
    commentBanned: Boolean(row.commentBanned),
  }
}

function getSessionSecret() {
  const runtimeConfig = useRuntimeConfig()
  const secret = getRuntimeEnv('AUTH_SESSION_SECRET', runtimeConfig.authSessionSecret)

  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is required.')
  }

  return secret
}

function getAdminIdentitySet() {
  const runtimeConfig = useRuntimeConfig()
  return new Set(
    getRuntimeEnv('ADMIN_IDENTITIES', runtimeConfig.adminIdentities)
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )
}

function buildIdentityKey(provider: string, providerUserId: string) {
  return `${provider}:${providerUserId}`.toLowerCase()
}

function resolveRole(provider: string, providerUserId: string, existingRole: string | null) {
  if (existingRole === 'admin') {
    return 'admin'
  }

  return getAdminIdentitySet().has(buildIdentityKey(provider, providerUserId)) ? 'admin' : 'user'
}

async function buildSessionTokenHash(token: string) {
  return hmacSha256Hex(getSessionSecret(), `session:${token}`)
}

async function upsertProviderUser(event: H3Event, input: UpsertProviderUserInput) {
  const database = await useDatabase(event)
  const now = getNowIso()
  const existing = await database.first<UserRow>(
    `
      SELECT
        id,
        provider,
        provider_user_id AS providerUserId,
        username,
        display_name AS displayName,
        avatar_url AS avatarUrl,
        email,
        role,
        comment_banned AS commentBanned
      FROM users
      WHERE provider = ? AND provider_user_id = ?
      LIMIT 1
    `,
    [input.provider, input.providerUserId],
  )

  const role = resolveRole(input.provider, input.providerUserId, existing?.role || null)

  if (existing) {
    await database.run(
      `
        UPDATE users
        SET
          username = ?,
          display_name = ?,
          avatar_url = ?,
          email = ?,
          role = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [input.username, input.displayName, input.avatarUrl, input.email, role, now, existing.id],
    )

    return {
      ...mapUserRow(existing),
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      email: input.email,
      role,
    } satisfies SessionUser
  }

  const insertResult = await database.run(
    `
      INSERT INTO users (
        provider,
        provider_user_id,
        username,
        display_name,
        avatar_url,
        email,
        role,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [input.provider, input.providerUserId, input.username, input.displayName, input.avatarUrl, input.email, role, now, now],
  )

  const created = await database.first<UserRow>(
    `
      SELECT
        id,
        provider,
        provider_user_id AS providerUserId,
        username,
        display_name AS displayName,
        avatar_url AS avatarUrl,
        email,
        role,
        comment_banned AS commentBanned
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [insertResult.lastInsertId],
  )

  if (!created) {
    throw new Error('Failed to load created user.')
  }

  return mapUserRow(created)
}

export async function createSession(event: H3Event, userId: number) {
  const database = await useDatabase(event)
  const now = getNowIso()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  const token = createRandomToken()
  const tokenHash = await buildSessionTokenHash(token)
  const userAgent = getRequestHeader(event, 'user-agent')?.slice(0, 512) || null
  const requestIp = getRequestIP(event, { xForwardedFor: true })
  const ipHash = requestIp ? await hmacSha256Hex(getSessionSecret(), `ip:${requestIp}`) : null

  await database.run(
    `
      INSERT INTO sessions (
        user_id,
        token_hash,
        expires_at,
        created_at,
        last_seen_at,
        ip_hash,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, tokenHash, expiresAt, now, now, ipHash, userAgent],
  )

  setCookie(event, SESSION_COOKIE, token, getCookieOptions(event, SESSION_TTL_SECONDS))
}

export async function invalidateCurrentSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  deleteCookie(event, SESSION_COOKIE, getCookieOptions(event, 0))

  if (!token) {
    return
  }

  const database = await useDatabase(event)
  const tokenHash = await buildSessionTokenHash(token)

  await database.run(
    'UPDATE sessions SET invalidated_at = ? WHERE token_hash = ? AND invalidated_at IS NULL',
    [getNowIso(), tokenHash],
  )
}

export async function getSessionContext(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) {
    return null
  }

  const database = await useDatabase(event)
  const tokenHash = await buildSessionTokenHash(token)
  const now = getNowIso()
  const row = await database.first<SessionRow>(
    `
      SELECT
        sessions.id AS sessionId,
        sessions.expires_at AS expiresAt,
        users.id AS id,
        users.provider AS provider,
        users.provider_user_id AS providerUserId,
        users.username AS username,
        users.display_name AS displayName,
        users.avatar_url AS avatarUrl,
        users.email AS email,
        users.role AS role,
        users.comment_banned AS commentBanned
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND sessions.invalidated_at IS NULL
        AND sessions.expires_at > ?
      LIMIT 1
    `,
    [tokenHash, now],
  )

  if (!row) {
    deleteCookie(event, SESSION_COOKIE, getCookieOptions(event, 0))
    return null
  }

  await database.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [now, row.sessionId])

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: mapUserRow(row),
  }
}

export async function getCurrentUser(event: H3Event) {
  const session = await getSessionContext(event)
  return session?.user || null
}

export async function getGithubAuthorizationUrl(event: H3Event) {
  const runtimeConfig = useRuntimeConfig()
  const clientId = getRuntimeEnv('GITHUB_OAUTH_CLIENT_ID', runtimeConfig.githubOauthClientId)

  if (isPlaceholderValue(clientId)) {
    throw new Error('GITHUB_OAUTH_CLIENT_ID is not configured.')
  }

  const state = createRandomToken(24)
  setCookie(event, GITHUB_STATE_COOKIE, state, getCookieOptions(event, 10 * 60))

  const redirectUri = `${getPublicRuntimeConfig().siteBaseUrl.replace(/\/$/u, '')}/api/auth/github/callback`
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)

  return url.toString()
}

function consumeGithubState(event: H3Event) {
  const state = getCookie(event, GITHUB_STATE_COOKIE)
  deleteCookie(event, GITHUB_STATE_COOKIE, getCookieOptions(event, 0))
  return state || null
}

async function fetchGithubProfile(accessToken: string) {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'subtitle-group-site',
  }

  const profileResponse = await fetch('https://api.github.com/user', { headers })
  if (!profileResponse.ok) {
    throw new Error('GitHub user profile fetch failed.')
  }

  const profile = (await profileResponse.json()) as GithubProfile
  let email = profile.email || null

  if (!email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', { headers })
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string
        primary: boolean
        verified: boolean
      }>
      const primaryEmail = emails.find((entry) => entry.primary && entry.verified) || emails.find((entry) => entry.verified)
      email = primaryEmail?.email || null
    }
  }

  return {
    provider: 'github' as const,
    providerUserId: String(profile.id),
    username: profile.login || null,
    displayName: profile.name || profile.login,
    avatarUrl: profile.avatar_url || null,
    email,
  }
}

export async function handleGithubCallback(event: H3Event, code: string, state: string) {
  const runtimeConfig = useRuntimeConfig()
  const clientId = getRuntimeEnv('GITHUB_OAUTH_CLIENT_ID', runtimeConfig.githubOauthClientId)
  const clientSecret = getRuntimeEnv('GITHUB_OAUTH_CLIENT_SECRET', runtimeConfig.githubOauthClientSecret)
  const expectedState = consumeGithubState(event)
  const siteBaseUrl = getPublicRuntimeConfig().siteBaseUrl

  if (!expectedState || expectedState !== state) {
    return false
  }

  if (isPlaceholderValue(clientId) || isPlaceholderValue(clientSecret)) {
    throw new Error('GitHub OAuth credentials are not configured.')
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'subtitle-group-site',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${siteBaseUrl.replace(/\/$/u, '')}/api/auth/github/callback`,
      state,
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error('GitHub token exchange failed.')
  }

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string
  }

  if (!tokenPayload.access_token) {
    throw new Error('GitHub token exchange did not return an access token.')
  }

  const user = await upsertProviderUser(event, await fetchGithubProfile(tokenPayload.access_token))
  await createSession(event, user.id)
  await sendRedirect(event, '/')
  return true
}

async function createTelegramSecretKey() {
  const runtimeConfig = useRuntimeConfig()
  const token = getRuntimeEnv('TELEGRAM_BOT_TOKEN', runtimeConfig.telegramBotToken)

  if (isPlaceholderValue(token)) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.')
  }

  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
}

async function signTelegramPayload(payload: string) {
  const secret = await createTelegramSecretKey()
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((entry) => entry.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyTelegramPayload(payload: TelegramPayload) {
  const authDate = Number(payload.auth_date)
  const now = Math.floor(Date.now() / 1000)

  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate > TELEGRAM_MAX_AGE_SECONDS) {
    return false
  }

  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== 'hash' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort()

  const signature = await signTelegramPayload(entries.join('\n'))
  return signature === payload.hash
}

export async function handleTelegramLogin(event: H3Event, payload: TelegramPayload) {
  const user = await upsertProviderUser(event, {
    provider: 'telegram',
    providerUserId: String(payload.id),
    username: payload.username || null,
    displayName: [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim() || payload.username || `tg-${payload.id}`,
    avatarUrl: payload.photo_url || null,
    email: null,
  })

  await createSession(event, user.id)
  return user
}
