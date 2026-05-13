import type { H3Event } from 'h3'
import { getRequestHeader, getRequestIP } from 'h3'
import type { ApiErrorCode } from '~/server/utils/api'
import { hmacSha256Hex } from '~/server/utils/crypto'
import { useDatabase } from '~/server/utils/database'

type CountRow = {
  total: number
}

type DownloadClickSummaryRow = {
  downloadSlug: string
  fileId: string
  linkType: string
  total: number
  lastSeenAt: string
}

type SearchQuerySummaryRow = {
  queryText: string
  searchType: string
  total: number
  averageResults: number
  lastSeenAt: string
}

type SearchRequestRow = {
  queryText: string
  searchType: string
  page: number
  pageSize: number
  totalResults: number
  returnedItems: number
  createdAt: string
}

type CommentFailureSummaryRow = {
  errorCode: string
  articleSlug: string | null
  total: number
  lastSeenAt: string
}

type CommentFailureRow = {
  errorCode: string
  errorMessage: string
  articleSlug: string | null
  authenticated: number
  createdAt: string
}

function getSessionHashSecret() {
  const runtimeConfig = useRuntimeConfig()
  return process.env.AUTH_SESSION_SECRET || runtimeConfig.authSessionSecret || 'subtitle-group-site'
}

function trimForStorage(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength)
}

function normalizeSearchQuery(value: string) {
  return value.toLowerCase().trim().slice(0, 200)
}

async function buildRequestAuditContext(event: H3Event) {
  const requestIp = getRequestIP(event, { xForwardedFor: true })
  const ipHash = requestIp ? await hmacSha256Hex(getSessionHashSecret(), `audit-ip:${requestIp}`) : null

  return {
    ipHash,
    userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 512) || null,
  }
}

export async function recordSearchRequest(
  event: H3Event,
  payload: {
    queryText: string
    searchType: 'all' | 'articles' | 'downloads'
    page: number
    pageSize: number
    totalResults: number
    totalPages: number
    returnedItems: number
  },
) {
  const queryText = trimForStorage(payload.queryText, 200)
  const queryNorm = normalizeSearchQuery(queryText)

  if (!queryText || !queryNorm) {
    return
  }

  try {
    const database = await useDatabase(event)
    const { ipHash, userAgent } = await buildRequestAuditContext(event)

    await database.run(
      `
        INSERT INTO search_requests (
          query_text,
          query_norm,
          search_type,
          page,
          page_size,
          total_results,
          total_pages,
          returned_items,
          created_at,
          ip_hash,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        queryText,
        queryNorm,
        payload.searchType,
        payload.page,
        payload.pageSize,
        payload.totalResults,
        payload.totalPages,
        payload.returnedItems,
        new Date().toISOString(),
        ipHash,
        userAgent,
      ],
    )
  } catch (error) {
    console.error('[observability/search]', error)
  }
}

export async function recordCommentFailure(
  event: H3Event,
  payload: {
    articleSlug: string | null
    userId: number | null
    authenticated: boolean
    errorCode: ApiErrorCode
    errorMessage: string
  },
) {
  try {
    const database = await useDatabase(event)
    const { ipHash, userAgent } = await buildRequestAuditContext(event)

    await database.run(
      `
        INSERT INTO comment_failures (
          article_slug,
          user_id,
          error_code,
          error_message,
          authenticated,
          created_at,
          ip_hash,
          user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.articleSlug,
        payload.userId,
        payload.errorCode,
        trimForStorage(payload.errorMessage, 300),
        payload.authenticated ? 1 : 0,
        new Date().toISOString(),
        ipHash,
        userAgent,
      ],
    )
  } catch (error) {
    console.error('[observability/comment-failure]', error)
  }
}

export async function getObservabilitySnapshot(event: H3Event, windowHours: number) {
  const clampedHours = Math.min(168, Math.max(1, Math.trunc(windowHours) || 72))
  const since = new Date(Date.now() - clampedHours * 60 * 60 * 1000).toISOString()
  const database = await useDatabase(event)

  const [
    downloadClicksTotalRow,
    searchRequestsTotalRow,
    commentFailuresTotalRow,
    downloadClicks,
    searchTopQueries,
    recentSearches,
    commentFailureSummary,
    recentCommentFailures,
  ] = await Promise.all([
    database.first<CountRow>('SELECT COUNT(*) AS total FROM download_clicks WHERE created_at >= ?', [since]),
    database.first<CountRow>('SELECT COUNT(*) AS total FROM search_requests WHERE created_at >= ?', [since]),
    database.first<CountRow>('SELECT COUNT(*) AS total FROM comment_failures WHERE created_at >= ?', [since]),
    database.all<DownloadClickSummaryRow>(
      `
        SELECT
          download_slug AS downloadSlug,
          file_id AS fileId,
          link_type AS linkType,
          COUNT(*) AS total,
          MAX(created_at) AS lastSeenAt
        FROM download_clicks
        WHERE created_at >= ?
        GROUP BY download_slug, file_id, link_type
        ORDER BY total DESC, lastSeenAt DESC, download_slug ASC, file_id ASC, link_type ASC
        LIMIT 12
      `,
      [since],
    ),
    database.all<SearchQuerySummaryRow>(
      `
        SELECT
          MIN(query_text) AS queryText,
          search_type AS searchType,
          COUNT(*) AS total,
          ROUND(AVG(total_results), 2) AS averageResults,
          MAX(created_at) AS lastSeenAt
        FROM search_requests
        WHERE created_at >= ?
        GROUP BY query_norm, search_type
        ORDER BY total DESC, lastSeenAt DESC, queryText ASC
        LIMIT 10
      `,
      [since],
    ),
    database.all<SearchRequestRow>(
      `
        SELECT
          query_text AS queryText,
          search_type AS searchType,
          page AS page,
          page_size AS pageSize,
          total_results AS totalResults,
          returned_items AS returnedItems,
          created_at AS createdAt
        FROM search_requests
        WHERE created_at >= ?
        ORDER BY created_at DESC, id DESC
        LIMIT 12
      `,
      [since],
    ),
    database.all<CommentFailureSummaryRow>(
      `
        SELECT
          error_code AS errorCode,
          article_slug AS articleSlug,
          COUNT(*) AS total,
          MAX(created_at) AS lastSeenAt
        FROM comment_failures
        WHERE created_at >= ?
        GROUP BY error_code, article_slug
        ORDER BY total DESC, lastSeenAt DESC, errorCode ASC
        LIMIT 10
      `,
      [since],
    ),
    database.all<CommentFailureRow>(
      `
        SELECT
          error_code AS errorCode,
          error_message AS errorMessage,
          article_slug AS articleSlug,
          authenticated AS authenticated,
          created_at AS createdAt
        FROM comment_failures
        WHERE created_at >= ?
        ORDER BY created_at DESC, id DESC
        LIMIT 12
      `,
      [since],
    ),
  ])

  return {
    windowHours: clampedHours,
    since,
    totals: {
      downloadClicks: downloadClicksTotalRow?.total || 0,
      searchRequests: searchRequestsTotalRow?.total || 0,
      commentFailures: commentFailuresTotalRow?.total || 0,
    },
    downloadClicks,
    searchTopQueries,
    recentSearches,
    commentFailureSummary: commentFailureSummary.map((entry) => ({
      ...entry,
      articleSlug: entry.articleSlug || '(unknown)',
    })),
    recentCommentFailures: recentCommentFailures.map((entry) => ({
      ...entry,
      articleSlug: entry.articleSlug || '(unknown)',
      authenticated: Boolean(entry.authenticated),
    })),
  }
}
