import BetterSqlite3 from 'better-sqlite3'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const articleSlug = 'field-notes-on-release-orchestration'
const adminIdentity = { provider: 'github', providerUserId: '9001' }
const memberIdentity = { provider: 'telegram', providerUserId: '9002' }
const sessionSecret = 'test-session-secret'
const port = Number(process.env.VERIFY_PORT || 3001)
const baseUrl = `http://127.0.0.1:${port}`
const cookieName = 'sgs_session'
const devTurnstileToken = 'dev-turnstile-pass'
const testId = `e2e-${Date.now()}`
const adminToken = `${testId}-admin`
const memberToken = `${testId}-member`
const memberReauthToken = `${testId}-member-reauth`
const adminBody = `[${testId}] admin approved comment`
const memberBody = `[${testId}] member pending comment`
const deleteBody = `[${testId}] delete me`
const bannedBody = `[${testId}] banned member attempt`
const reportReason = `report-${testId}`
const nowIso = () => new Date().toISOString()

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = resolve(projectRoot, '.data', 'site.db')
const serverPath = resolve(projectRoot, '.output', 'server', 'index.mjs')

const checks = []
const serverLogs = {
  stdout: '',
  stderr: '',
}

function recordCheck(name, ok, detail) {
  checks.push({ name, ok, detail })
}

function cookieValue(token) {
  return `${cookieName}=${token}`
}

function sessionHash(token) {
  return createHmac('sha256', sessionSecret).update(`session:${token}`).digest('hex')
}

async function sleep(ms) {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function waitForServer(serverProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Server exited early with code ${serverProcess.exitCode}.`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/me`, {
        signal: AbortSignal.timeout(1000),
      })

      if (response.ok) {
        return
      }
    } catch {
      // Retry until the server is ready.
    }

    await sleep(250)
  }

  throw new Error('Timed out waiting for the local server to start.')
}

async function requestJson(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  })

  return {
    status: response.status,
    json: await response.json(),
  }
}

async function requestText(path, { cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: AbortSignal.timeout(5000),
  })

  return {
    status: response.status,
    text: await response.text(),
  }
}

function cleanupTestUsers(database) {
  const users = database
    .prepare(
      `
        SELECT id
        FROM users
        WHERE (provider = ? AND provider_user_id = ?)
           OR (provider = ? AND provider_user_id = ?)
      `,
    )
    .all(
      adminIdentity.provider,
      adminIdentity.providerUserId,
      memberIdentity.provider,
      memberIdentity.providerUserId,
    )

  if (!users.length) {
    return
  }

  const userIds = users.map((entry) => Number(entry.id))
  const placeholders = userIds.map(() => '?').join(', ')
  const commentIds = database
    .prepare(`SELECT id FROM comments WHERE user_id IN (${placeholders})`)
    .all(...userIds)
    .map((entry) => Number(entry.id))

  if (commentIds.length) {
    const commentPlaceholders = commentIds.map(() => '?').join(', ')
    database.prepare(`DELETE FROM comment_reports WHERE comment_id IN (${commentPlaceholders})`).run(...commentIds)
    database.prepare(`DELETE FROM comment_moderation_logs WHERE comment_id IN (${commentPlaceholders})`).run(...commentIds)
    database.prepare(`DELETE FROM comments WHERE id IN (${commentPlaceholders})`).run(...commentIds)
  }

  database.prepare(`DELETE FROM comment_moderation_logs WHERE admin_user_id IN (${placeholders})`).run(...userIds)
  database.prepare(`DELETE FROM sessions WHERE user_id IN (${placeholders})`).run(...userIds)
  database.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds)
}

function upsertUser(database, { provider, providerUserId, username, displayName, role }) {
  const existing = database
    .prepare(
      `
        SELECT id
        FROM users
        WHERE provider = ? AND provider_user_id = ?
        LIMIT 1
      `,
    )
    .get(provider, providerUserId)

  const timestamp = nowIso()

  if (existing) {
    database
      .prepare(
        `
          UPDATE users
          SET
            username = ?,
            display_name = ?,
            avatar_url = NULL,
            email = NULL,
            role = ?,
            comment_banned = 0,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run(username, displayName, role, timestamp, Number(existing.id))

    return Number(existing.id)
  }

  const result = database
    .prepare(
      `
        INSERT INTO users (
          provider,
          provider_user_id,
          username,
          display_name,
          avatar_url,
          email,
          role,
          comment_banned,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, NULL, NULL, ?, 0, ?, ?)
      `,
    )
    .run(provider, providerUserId, username, displayName, role, timestamp, timestamp)

  return Number(result.lastInsertRowid)
}

function createSession(database, userId, token) {
  const timestamp = nowIso()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const tokenHash = sessionHash(token)

  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  database
    .prepare(
      `
        INSERT INTO sessions (
          user_id,
          token_hash,
          expires_at,
          created_at,
          last_seen_at,
          ip_hash,
          user_agent,
          invalidated_at
        )
        VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)
      `,
    )
    .run(userId, tokenHash, expiresAt, timestamp, timestamp, `verify-auth-comments:${token}`)
}

function findCommentId(database, body) {
  const row = database
    .prepare(
      `
        SELECT id
        FROM comments
        WHERE body = ?
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(body)

  return row ? Number(row.id) : null
}

function findCommentStatus(database, id) {
  const row = database
    .prepare(
      `
        SELECT status
        FROM comments
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(id)

  return row ? row.status : null
}

async function main() {
  await mkdir(dirname(databasePath), { recursive: true })

  const serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      AUTH_SESSION_SECRET: sessionSecret,
      DEPLOY_MODE: 'local',
      SITE_BASE_URL: baseUrl,
      TURNSTILE_SITE_KEY: 'replace-with-dev-site-key',
      TURNSTILE_SECRET_KEY: 'replace-with-dev-secret-key',
      GITHUB_OAUTH_CLIENT_ID: 'runtime-github-client-id',
      GITHUB_OAUTH_CLIENT_SECRET: 'runtime-github-client-secret',
      TELEGRAM_BOT_NAME: 'runtime_subtitle_group_bot',
      TELEGRAM_BOT_TOKEN: 'runtime-telegram-bot-token',
      ADMIN_IDENTITIES: `${adminIdentity.provider}:${adminIdentity.providerUserId}`,
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', (chunk) => {
    serverLogs.stdout += chunk.toString()
  })
  serverProcess.stderr.on('data', (chunk) => {
    serverLogs.stderr += chunk.toString()
  })

  const database = new BetterSqlite3(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  try {
    await waitForServer(serverProcess)

    await requestJson(`/api/comments?articleSlug=${articleSlug}`)

    cleanupTestUsers(database)

    const adminUserId = upsertUser(database, {
      ...adminIdentity,
      username: 'e2e-admin',
      displayName: `E2E Admin ${testId}`,
      role: 'admin',
    })
    const memberUserId = upsertUser(database, {
      ...memberIdentity,
      username: 'e2e-member',
      displayName: `E2E Member ${testId}`,
      role: 'user',
    })

    createSession(database, adminUserId, adminToken)
    createSession(database, memberUserId, memberToken)

    const guestMe = await requestJson('/api/me')
    recordCheck(
      'guest /api/me returns unauthenticated',
      guestMe.status === 200 && guestMe.json.ok === true && guestMe.json.data.authenticated === false,
      JSON.stringify(guestMe.json),
    )
    recordCheck(
      'runtime auth config is exposed from /api/me',
      guestMe.json.data.auth.githubAvailable === true
        && guestMe.json.data.auth.telegramAvailable === true
        && guestMe.json.data.auth.telegramBotName === 'runtime_subtitle_group_bot',
      JSON.stringify(guestMe.json.data.auth),
    )

    const adminMe = await requestJson('/api/me', { cookie: cookieValue(adminToken) })
    recordCheck(
      'admin session is readable',
      adminMe.status === 200
        && adminMe.json.ok === true
        && adminMe.json.data.authenticated === true
        && adminMe.json.data.user?.role === 'admin',
      JSON.stringify(adminMe.json),
    )

    const memberMe = await requestJson('/api/me', { cookie: cookieValue(memberToken) })
    recordCheck(
      'member session is readable',
      memberMe.status === 200
        && memberMe.json.ok === true
        && memberMe.json.data.authenticated === true
        && memberMe.json.data.user?.role === 'user',
      JSON.stringify(memberMe.json),
    )

    const memberPost = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(memberToken),
      body: {
        articleSlug,
        body: memberBody,
        turnstileToken: devTurnstileToken,
      },
    })
    const memberCommentId = findCommentId(database, memberBody)
    recordCheck(
      'member comment lands in pending review',
      memberPost.status === 200
        && memberPost.json.ok === true
        && memberPost.json.data.status === 'pending'
        && memberCommentId !== null
        && findCommentStatus(database, memberCommentId) === 'pending',
      JSON.stringify(memberPost.json),
    )

    const adminPost = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(adminToken),
      body: {
        articleSlug,
        body: adminBody,
        turnstileToken: devTurnstileToken,
      },
    })
    const adminCommentId = findCommentId(database, adminBody)
    recordCheck(
      'admin comment auto-approves',
      adminPost.status === 200
        && adminPost.json.ok === true
        && adminPost.json.data.status === 'approved'
        && adminCommentId !== null
        && findCommentStatus(database, adminCommentId) === 'approved',
      JSON.stringify(adminPost.json),
    )

    const publicAfterCreate = await requestJson(`/api/comments?articleSlug=${articleSlug}`)
    const publicBodiesAfterCreate = publicAfterCreate.json.data.items.map((entry) => entry.body)
    recordCheck(
      'public comments only show approved entries',
      publicAfterCreate.status === 200
        && publicBodiesAfterCreate.includes(adminBody)
        && !publicBodiesAfterCreate.includes(memberBody),
      JSON.stringify(publicAfterCreate.json.data.items),
    )

    const reportResponse = await requestJson(`/api/comments/${adminCommentId}/report`, {
      method: 'POST',
      cookie: cookieValue(memberToken),
      body: {
        reason: reportReason,
      },
    })
    recordCheck(
      'member can report an approved comment',
      reportResponse.status === 200 && reportResponse.json.ok === true && reportResponse.json.data.reported === true,
      JSON.stringify(reportResponse.json),
    )

    const pendingQueue = await requestJson('/api/admin/comments?status=pending', {
      cookie: cookieValue(adminToken),
    })
    recordCheck(
      'admin queue exposes pending member comment',
      pendingQueue.status === 200
        && pendingQueue.json.ok === true
        && pendingQueue.json.data.items.some((entry) => entry.id === memberCommentId),
      JSON.stringify(pendingQueue.json.data.items),
    )

    const approvePending = await requestJson(`/api/admin/comments/${memberCommentId}/moderate`, {
      method: 'POST',
      cookie: cookieValue(adminToken),
      body: {
        action: 'approve',
        note: `approve-${testId}`,
      },
    })
    recordCheck(
      'admin can approve pending comment',
      approvePending.status === 200
        && approvePending.json.ok === true
        && findCommentStatus(database, memberCommentId) === 'approved',
      JSON.stringify(approvePending.json),
    )

    const publicAfterApprove = await requestJson(`/api/comments?articleSlug=${articleSlug}`)
    const publicBodiesAfterApprove = publicAfterApprove.json.data.items.map((entry) => entry.body)
    recordCheck(
      'approved member comment becomes public',
      publicAfterApprove.status === 200
        && publicBodiesAfterApprove.includes(adminBody)
        && publicBodiesAfterApprove.includes(memberBody),
      JSON.stringify(publicAfterApprove.json.data.items),
    )

    const approvedQueue = await requestJson('/api/admin/comments?status=approved', {
      cookie: cookieValue(adminToken),
    })
    const approvedAdminComment = approvedQueue.json.data.items.find((entry) => entry.id === adminCommentId)
    recordCheck(
      'admin queue includes report metadata',
      approvedQueue.status === 200
        && approvedQueue.json.ok === true
        && approvedAdminComment?.reportCount >= 1
        && approvedAdminComment?.latestReportReason === reportReason,
      JSON.stringify(approvedAdminComment),
    )

    const deleteSource = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(adminToken),
      body: {
        articleSlug,
        body: deleteBody,
        turnstileToken: devTurnstileToken,
      },
    })
    const deleteCommentId = findCommentId(database, deleteBody)
    recordCheck(
      'delete target comment is created as approved',
      deleteSource.status === 200
        && deleteSource.json.ok === true
        && deleteSource.json.data.status === 'approved'
        && deleteCommentId !== null,
      JSON.stringify(deleteSource.json),
    )

    const deleteResponse = await requestJson(`/api/admin/comments/${deleteCommentId}`, {
      method: 'DELETE',
      cookie: cookieValue(adminToken),
      body: {
        note: `delete-${testId}`,
      },
    })
    const publicAfterDelete = await requestJson(`/api/comments?articleSlug=${articleSlug}`)
    recordCheck(
      'admin delete removes comment from public list',
      deleteResponse.status === 200
        && deleteResponse.json.ok === true
        && !publicAfterDelete.json.data.items.some((entry) => entry.body === deleteBody),
      JSON.stringify(publicAfterDelete.json.data.items),
    )

    const banResponse = await requestJson(`/api/admin/users/${memberUserId}/ban`, {
      method: 'POST',
      cookie: cookieValue(adminToken),
      body: {
        note: `ban-${testId}`,
      },
    })
    recordCheck(
      'admin can ban a member user',
      banResponse.status === 200
        && banResponse.json.ok === true
        && database.prepare('SELECT comment_banned AS commentBanned FROM users WHERE id = ?').get(memberUserId)?.commentBanned === 1,
      JSON.stringify(banResponse.json),
    )

    const bannedOldSession = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(memberToken),
      body: {
        articleSlug,
        body: bannedBody,
        turnstileToken: devTurnstileToken,
      },
    })
    recordCheck(
      'ban invalidates active member session',
      bannedOldSession.status === 401 && bannedOldSession.json.ok === false && bannedOldSession.json.error?.code === 'UNAUTHORIZED',
      JSON.stringify(bannedOldSession.json),
    )

    createSession(database, memberUserId, memberReauthToken)
    const bannedFreshSession = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(memberReauthToken),
      body: {
        articleSlug,
        body: `${bannedBody} reauth`,
        turnstileToken: devTurnstileToken,
      },
    })
    recordCheck(
      'banned member stays blocked after re-authentication',
      bannedFreshSession.status === 403 && bannedFreshSession.json.ok === false && bannedFreshSession.json.error?.code === 'FORBIDDEN',
      JSON.stringify(bannedFreshSession.json),
    )

    const adminPage = await requestText('/admin/comments', {
      cookie: cookieValue(adminToken),
    })
    recordCheck(
      'admin moderation page renders for admin session',
      adminPage.status === 200,
      `status=${adminPage.status}`,
    )

    const articlePage = await requestText(`/articles/${articleSlug}`)
    recordCheck(
      'article page keeps guest login entry visible with runtime auth config',
      articlePage.status === 200
        && articlePage.text.includes('GitHub Login')
        && !articlePage.text.includes('Login providers are not configured in this environment yet.'),
      `status=${articlePage.status}`,
    )
  } finally {
    cleanupTestUsers(database)
    database.close()

    serverProcess.kill()
    await Promise.race([
      new Promise((resolvePromise) => serverProcess.once('exit', resolvePromise)),
      sleep(2000),
    ])

    if (serverProcess.exitCode === null) {
      serverProcess.kill('SIGKILL')
    }
  }

  const failedChecks = checks.filter((entry) => !entry.ok)

  if (failedChecks.length) {
    const failure = {
      ok: false,
      failedChecks,
      checks,
      serverLogs: {
        stdoutTail: serverLogs.stdout.trim().split('\n').slice(-20),
        stderrTail: serverLogs.stderr.trim().split('\n').slice(-20),
      },
    }

    console.error(JSON.stringify(failure, null, 2))
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        fatal: error instanceof Error ? error.message : String(error),
        checks,
        serverLogs: {
          stdoutTail: serverLogs.stdout.trim().split('\n').slice(-20),
          stderrTail: serverLogs.stderr.trim().split('\n').slice(-20),
        },
      },
      null,
      2,
    ),
  )
  process.exit(1)
})
