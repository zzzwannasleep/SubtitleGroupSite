import BetterSqlite3 from 'better-sqlite3'
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const articleSlug = 'field-notes-on-release-orchestration'
const adminIdentity = { provider: 'github', providerUserId: '9101' }
const sessionSecret = 'verify-observability-session-secret'
const port = Number(process.env.VERIFY_PORT || 3004)
const baseUrl = `http://127.0.0.1:${port}`
const cookieName = 'sgs_session'
const devTurnstileToken = 'dev-turnstile-pass'
const testId = `ops-${Date.now()}`
const adminToken = `${testId}-admin`
const queryA = `telemetry-${testId}`
const queryB = `observability-${testId}`
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
      const response = await fetch(`${baseUrl}/api/downloads`, {
        signal: AbortSignal.timeout(1000),
      })

      if (response.ok) {
        return
      }
    } catch {
      // Retry until ready.
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

function ensureObservabilityTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      username TEXT,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      comment_banned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      invalidated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS search_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_text TEXT NOT NULL,
      query_norm TEXT NOT NULL,
      search_type TEXT NOT NULL,
      page INTEGER NOT NULL,
      page_size INTEGER NOT NULL,
      total_results INTEGER NOT NULL,
      total_pages INTEGER NOT NULL,
      returned_items INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS comment_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_slug TEXT,
      user_id INTEGER,
      error_code TEXT NOT NULL,
      error_message TEXT NOT NULL,
      authenticated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT
    );
  `)
}

function cleanupTestUsers(database) {
  const users = database
    .prepare(
      `
        SELECT id
        FROM users
        WHERE provider = ? AND provider_user_id = ?
      `,
    )
    .all(adminIdentity.provider, adminIdentity.providerUserId)

  if (!users.length) {
    return
  }

  const userIds = users.map((entry) => Number(entry.id))
  const placeholders = userIds.map(() => '?').join(', ')

  database.prepare(`DELETE FROM sessions WHERE user_id IN (${placeholders})`).run(...userIds)
  database.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds)
}

function upsertAdminUser(database) {
  const existing = database
    .prepare(
      `
        SELECT id
        FROM users
        WHERE provider = ? AND provider_user_id = ?
        LIMIT 1
      `,
    )
    .get(adminIdentity.provider, adminIdentity.providerUserId)

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
            role = 'admin',
            comment_banned = 0,
            updated_at = ?
          WHERE id = ?
        `,
      )
      .run('ops-admin', `Ops Admin ${testId}`, timestamp, Number(existing.id))

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
        VALUES (?, ?, ?, ?, NULL, NULL, 'admin', 0, ?, ?)
      `,
    )
    .run(adminIdentity.provider, adminIdentity.providerUserId, 'ops-admin', `Ops Admin ${testId}`, timestamp, timestamp)

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
    .run(userId, tokenHash, expiresAt, timestamp, timestamp, `verify-observability:${token}`)
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
  ensureObservabilityTables(database)

  try {
    await waitForServer(serverProcess)

    cleanupTestUsers(database)
    const adminUserId = upsertAdminUser(database)
    createSession(database, adminUserId, adminToken)

    const beforeSearchCount = Number(
      database.prepare('SELECT COUNT(*) AS total FROM search_requests').get()?.total || 0,
    )
    const beforeFailureCount = Number(
      database.prepare('SELECT COUNT(*) AS total FROM comment_failures').get()?.total || 0,
    )

    const searchA = await requestJson(`/api/search?q=${encodeURIComponent(queryA)}&type=all&page=1&pageSize=5`)
    const searchB = await requestJson(`/api/search?q=${encodeURIComponent(queryB)}&type=downloads&page=1&pageSize=5`)
    recordCheck(
      'search endpoint still responds normally while telemetry is enabled',
      searchA.status === 200 && searchB.status === 200 && searchA.json.ok === true && searchB.json.ok === true,
      JSON.stringify({ searchA: searchA.json, searchB: searchB.json }),
    )

    const guestFailure = await requestJson('/api/comments', {
      method: 'POST',
      body: {
        articleSlug,
        body: `[${testId}] guest failure`,
        turnstileToken: devTurnstileToken,
      },
    })
    const turnstileFailure = await requestJson('/api/comments', {
      method: 'POST',
      cookie: cookieValue(adminToken),
      body: {
        articleSlug,
        body: `[${testId}] missing turnstile`,
        turnstileToken: '',
      },
    })
    recordCheck(
      'comment failures still return the correct public errors',
      guestFailure.status === 401
        && guestFailure.json.ok === false
        && guestFailure.json.error?.code === 'UNAUTHORIZED'
        && turnstileFailure.status === 400
        && turnstileFailure.json.ok === false
        && turnstileFailure.json.error?.code === 'TURNSTILE_FAILED',
      JSON.stringify({ guestFailure: guestFailure.json, turnstileFailure: turnstileFailure.json }),
    )

    const afterSearchCount = Number(
      database.prepare('SELECT COUNT(*) AS total FROM search_requests').get()?.total || 0,
    )
    const afterFailureCount = Number(
      database.prepare('SELECT COUNT(*) AS total FROM comment_failures').get()?.total || 0,
    )

    const loggedSearches = database
      .prepare(
        `
          SELECT query_text AS queryText, search_type AS searchType
          FROM search_requests
          WHERE query_text IN (?, ?)
          ORDER BY id DESC
        `,
      )
      .all(queryA, queryB)

    const loggedFailures = database
      .prepare(
        `
          SELECT error_code AS errorCode
          FROM comment_failures
          WHERE created_at >= ?
          ORDER BY id DESC
          LIMIT 4
        `,
      )
      .all(new Date(Date.now() - 5 * 60 * 1000).toISOString())

    recordCheck(
      'search request rows are persisted',
      afterSearchCount >= beforeSearchCount + 2
        && loggedSearches.some((entry) => entry.queryText === queryA && entry.searchType === 'all')
        && loggedSearches.some((entry) => entry.queryText === queryB && entry.searchType === 'downloads'),
      JSON.stringify({ beforeSearchCount, afterSearchCount, loggedSearches }),
    )

    recordCheck(
      'comment failure rows are persisted',
      afterFailureCount >= beforeFailureCount + 2
        && loggedFailures.some((entry) => entry.errorCode === 'UNAUTHORIZED')
        && loggedFailures.some((entry) => entry.errorCode === 'TURNSTILE_FAILED'),
      JSON.stringify({ beforeFailureCount, afterFailureCount, loggedFailures }),
    )

    const observability = await requestJson('/api/admin/observability?hours=24', {
      cookie: cookieValue(adminToken),
    })
    recordCheck(
      'admin observability endpoint exposes all three telemetry streams',
      observability.status === 200
        && observability.json.ok === true
        && observability.json.data.totals.searchRequests >= 2
        && observability.json.data.totals.commentFailures >= 2
        && Array.isArray(observability.json.data.recentSearches)
        && Array.isArray(observability.json.data.recentCommentFailures),
      JSON.stringify(observability.json.data),
    )

    const operationsPage = await requestText('/admin/operations', {
      cookie: cookieValue(adminToken),
    })
    recordCheck(
      'admin operations page renders for admin session',
      operationsPage.status === 200,
      `status=${operationsPage.status}`,
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
    console.error(
      JSON.stringify(
        {
          ok: false,
          failedChecks,
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
