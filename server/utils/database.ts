import type { H3Event } from 'h3'

type DatabaseScalar = string | number | null

type D1PreparedStatement = {
  bind: (...values: DatabaseScalar[]) => {
    all: <T>() => Promise<{ results?: T[] }>
    first: <T>() => Promise<T | null>
    run: () => Promise<{ meta?: { changes?: number; last_row_id?: number | string | null } }>
  }
}

type D1LikeDatabase = {
  prepare: (sql: string) => D1PreparedStatement
  exec: (sql: string) => Promise<unknown>
}

export type DatabaseDriver = {
  all: <T>(sql: string, params?: DatabaseScalar[]) => Promise<T[]>
  first: <T>(sql: string, params?: DatabaseScalar[]) => Promise<T | null>
  run: (sql: string, params?: DatabaseScalar[]) => Promise<{ rowsAffected: number; lastInsertId: number | null }>
  exec: (sql: string) => Promise<void>
}

const SCHEMA_STATEMENTS = [
  `
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
    )
  `,
  'CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity_idx ON users(provider, provider_user_id)',
  `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      invalidated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  'CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)',
  `
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_slug TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      body_norm TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      last_moderated_at TEXT,
      last_moderated_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  'CREATE INDEX IF NOT EXISTS comments_article_status_idx ON comments(article_slug, status)',
  'CREATE INDEX IF NOT EXISTS comments_user_created_idx ON comments(user_id, created_at)',
  'CREATE INDEX IF NOT EXISTS comments_ip_created_idx ON comments(ip_hash, created_at)',
  `
    CREATE TABLE IF NOT EXISTS comment_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      reporter_user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  'CREATE UNIQUE INDEX IF NOT EXISTS comment_reports_unique_idx ON comment_reports(comment_id, reporter_user_id)',
  `
    CREATE TABLE IF NOT EXISTS comment_moderation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  'CREATE INDEX IF NOT EXISTS comment_logs_comment_idx ON comment_moderation_logs(comment_id, created_at)',
  `
    CREATE TABLE IF NOT EXISTS download_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      download_slug TEXT NOT NULL,
      file_id TEXT NOT NULL,
      link_index INTEGER NOT NULL,
      link_type TEXT NOT NULL,
      link_label TEXT NOT NULL,
      target_url TEXT,
      created_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT
    )
  `,
  'CREATE INDEX IF NOT EXISTS download_clicks_distribution_idx ON download_clicks(download_slug, file_id, link_index, created_at)',
  `
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
    )
  `,
  'CREATE INDEX IF NOT EXISTS search_requests_created_idx ON search_requests(created_at)',
  'CREATE INDEX IF NOT EXISTS search_requests_query_idx ON search_requests(query_norm, search_type, created_at)',
  `
    CREATE TABLE IF NOT EXISTS comment_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_slug TEXT,
      user_id INTEGER,
      error_code TEXT NOT NULL,
      error_message TEXT NOT NULL,
      authenticated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,
  'CREATE INDEX IF NOT EXISTS comment_failures_created_idx ON comment_failures(created_at)',
  'CREATE INDEX IF NOT EXISTS comment_failures_code_idx ON comment_failures(error_code, created_at)',
  'CREATE INDEX IF NOT EXISTS comment_failures_article_idx ON comment_failures(article_slug, created_at)',
]

const localKey = {}
const workerInitState = new WeakMap<object, Promise<void>>()

const globalStore = globalThis as {
  __subtitleGroupLocalDriverPromise?: Promise<DatabaseDriver>
  __subtitleGroupLocalInitPromise?: Promise<void>
}

async function createLocalDriver() {
  const [{ mkdir }, { dirname, resolve }, betterSqlite3Module] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('better-sqlite3'),
  ])

  const BetterSqlite3 = betterSqlite3Module.default
  const databasePath = resolve(process.cwd(), '.data', 'site.db')
  await mkdir(dirname(databasePath), { recursive: true })

  const database = new BetterSqlite3(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  const driver: DatabaseDriver = {
    async all<T>(sql, params = []) {
      return database.prepare(sql).all(...params) as T[]
    },
    async first<T>(sql, params = []) {
      const row = database.prepare(sql).get(...params) as T | undefined
      return row ?? null
    },
    async run(sql, params = []) {
      const result = database.prepare(sql).run(...params)
      return {
        rowsAffected: result.changes,
        lastInsertId: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      }
    },
    async exec(sql) {
      database.exec(sql)
    },
  }

  return driver
}

function createD1Driver(database: D1LikeDatabase): DatabaseDriver {
  return {
    async all<T>(sql, params = []) {
      const result = await database.prepare(sql).bind(...params).all<T>()
      return result.results || []
    },
    async first<T>(sql, params = []) {
      return (await database.prepare(sql).bind(...params).first<T>()) ?? null
    },
    async run(sql, params = []) {
      const result = await database.prepare(sql).bind(...params).run()
      return {
        rowsAffected: result.meta?.changes || 0,
        lastInsertId: result.meta?.last_row_id ? Number(result.meta.last_row_id) : null,
      }
    },
    async exec(sql) {
      await database.exec(sql)
    },
  }
}

async function ensureSchema(driver: DatabaseDriver, key: object) {
  const existing = workerInitState.get(key)
  if (existing) {
    await existing
    return
  }

  const initPromise = (async () => {
    for (const statement of SCHEMA_STATEMENTS) {
      await driver.exec(statement)
    }
  })()

  workerInitState.set(key, initPromise)
  await initPromise
}

async function getLocalDriver() {
  if (!globalStore.__subtitleGroupLocalDriverPromise) {
    globalStore.__subtitleGroupLocalDriverPromise = createLocalDriver()
  }

  const driver = await globalStore.__subtitleGroupLocalDriverPromise

  if (!globalStore.__subtitleGroupLocalInitPromise) {
    globalStore.__subtitleGroupLocalInitPromise = ensureSchema(driver, localKey)
  }

  await globalStore.__subtitleGroupLocalInitPromise
  return driver
}

export async function useDatabase(event: H3Event) {
  const runtimeConfig = useRuntimeConfig()

  if (runtimeConfig.public.deployMode === 'workers') {
    const database = (event.context as { cloudflare?: { env?: { DB?: D1LikeDatabase } } }).cloudflare?.env?.DB

    if (!database) {
      throw new Error('Cloudflare D1 binding "DB" is not configured.')
    }

    const driver = createD1Driver(database)
    await ensureSchema(driver, database as unknown as object)
    return driver
  }

  return getLocalDriver()
}
