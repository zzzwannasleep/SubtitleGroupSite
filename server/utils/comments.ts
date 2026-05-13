import type { H3Event } from 'h3'
import { getRequestHeader } from 'h3'
import type { ApiErrorCode } from '~/server/utils/api'
import type { SessionUser } from '~/server/utils/auth'
import { getCurrentUser } from '~/server/utils/auth'
import { getContentManifest } from '~/server/utils/content-data'
import { normalizeIndexText, normalizeTextBlock } from '~/server/utils/crypto'
import { useDatabase } from '~/server/utils/database'

export const commentStatusValues = ['pending', 'approved', 'rejected', 'spam'] as const
export type CommentStatus = (typeof commentStatusValues)[number]

type CountRow = {
  total: number
}

type CommentMutationResult =
  | {
      ok: true
      status?: CommentStatus
      message?: string
    }
  | {
      ok: false
      code: ApiErrorCode
      message: string
    }

type PublicCommentRow = {
  id: number
  body: string
  createdAt: string
  displayName: string
  avatarUrl: string | null
  provider: 'github' | 'telegram'
}

type AdminCommentRow = {
  id: number
  articleSlug: string
  body: string
  status: CommentStatus
  createdAt: string
  updatedAt: string
  userId: number
  displayName: string
  username: string | null
  provider: 'github' | 'telegram'
  role: 'user' | 'admin'
  commentBanned: number
  reportCount: number
  latestReportReason: string | null
}

function getCommentRateLimitPerMinute() {
  return Math.max(
    1,
    Number.parseInt(process.env.COMMENT_RATE_LIMIT_PER_MINUTE || '', 10) || useRuntimeConfig().public.commentRateLimitPerMinute || 5,
  )
}

function getBlocklistTerms() {
  const raw = process.env.COMMENT_BLOCKLIST_WORDS || useRuntimeConfig().commentBlocklistWords
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function hasPublicArticle(articleSlug: string) {
  return getContentManifest().articles.some((entry) => entry.slug === articleSlug && !entry.draft)
}

function countExternalLinks(body: string) {
  return (body.match(/https?:\/\/|www\./giu) || []).length
}

function containsBlockedTerm(body: string) {
  const normalized = normalizeIndexText(body)
  return getBlocklistTerms().some((term) => normalized.includes(term))
}

async function createAuditLog(event: H3Event, adminUserId: number, action: string, note: string | null, commentId: number | null) {
  const database = await useDatabase(event)
  await database.run(
    `
      INSERT INTO comment_moderation_logs (
        comment_id,
        admin_user_id,
        action,
        note,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [commentId, adminUserId, action, note, new Date().toISOString()],
  )
}

export async function listPublicComments(event: H3Event, articleSlug: string, page: number, pageSize: number) {
  const database = await useDatabase(event)
  const totalRow = await database.first<CountRow>(
    'SELECT COUNT(*) AS total FROM comments WHERE article_slug = ? AND status = ?',
    [articleSlug, 'approved'],
  )

  const total = totalRow?.total || 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const items = await database.all<PublicCommentRow>(
    `
      SELECT
        comments.id AS id,
        comments.body AS body,
        comments.created_at AS createdAt,
        users.display_name AS displayName,
        users.avatar_url AS avatarUrl,
        users.provider AS provider
      FROM comments
      INNER JOIN users ON users.id = comments.user_id
      WHERE comments.article_slug = ?
        AND comments.status = ?
      ORDER BY comments.created_at ASC, comments.id ASC
      LIMIT ? OFFSET ?
    `,
    [articleSlug, 'approved', pageSize, offset],
  )

  return {
    page: total === 0 ? 1 : safePage,
    pageSize,
    total,
    totalPages,
    items,
  }
}

export async function createComment(
  event: H3Event,
  articleSlug: string,
  body: string,
  options?: {
    currentUser?: SessionUser | null
  },
): Promise<CommentMutationResult> {
  const user = options && 'currentUser' in options ? options.currentUser || null : await getCurrentUser(event)
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'You must be signed in before posting a comment.',
    }
  }

  if (user.commentBanned) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'This account is currently blocked from posting comments.',
    }
  }

  if (!hasPublicArticle(articleSlug)) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'The target article does not exist.',
    }
  }

  const normalizedBody = normalizeTextBlock(body)
  const bodyNorm = normalizeIndexText(normalizedBody)

  if (!normalizedBody || normalizedBody.length < 3 || normalizedBody.length > 2000) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Comment body must be between 3 and 2000 characters.',
    }
  }

  const database = await useDatabase(event)
  const minuteAgo = new Date(Date.now() - 60_000).toISOString()
  const rateLimit = getCommentRateLimitPerMinute()

  const [userCountRow, articleCountRow] = await Promise.all([
    database.first<CountRow>(
      'SELECT COUNT(*) AS total FROM comments WHERE user_id = ? AND created_at >= ?',
      [user.id, minuteAgo],
    ),
    database.first<CountRow>(
      'SELECT COUNT(*) AS total FROM comments WHERE user_id = ? AND article_slug = ? AND created_at >= ?',
      [user.id, articleSlug, minuteAgo],
    ),
  ])

  if ((userCountRow?.total || 0) >= rateLimit || (articleCountRow?.total || 0) >= rateLimit) {
    return {
      ok: false,
      code: 'RATE_LIMITED',
      message: 'Comment rate limit reached. Please wait a moment before posting again.',
    }
  }

  const duplicate = await database.first<{ id: number }>(
    `
      SELECT id
      FROM comments
      WHERE user_id = ?
        AND article_slug = ?
        AND body_norm = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [user.id, articleSlug, bodyNorm],
  )

  if (duplicate) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: 'Duplicate comment detected. Please update the message before sending again.',
    }
  }

  const linkCount = countExternalLinks(normalizedBody)
  const status: CommentStatus =
    containsBlockedTerm(normalizedBody) || linkCount > 3
      ? 'spam'
      : user.role === 'admin'
        ? 'approved'
        : 'pending'

  const now = new Date().toISOString()
  await database.run(
    `
      INSERT INTO comments (
        article_slug,
        user_id,
        body,
        body_norm,
        status,
        created_at,
        updated_at,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [articleSlug, user.id, normalizedBody, bodyNorm, status, now, now, getRequestHeader(event, 'user-agent')?.slice(0, 512) || null],
  )

  return {
    ok: true,
    status,
    message:
      status === 'approved'
        ? 'Comment published.'
        : status === 'spam'
          ? 'Comment was captured for review by the moderation rules.'
          : 'Comment submitted and queued for review.',
  }
}

export async function createCommentReport(event: H3Event, commentId: number, reason: string): Promise<CommentMutationResult> {
  const user = await getCurrentUser(event)
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'You must be signed in before reporting a comment.',
    }
  }

  const database = await useDatabase(event)
  const existing = await database.first<{ id: number }>('SELECT id FROM comments WHERE id = ? LIMIT 1', [commentId])

  if (!existing) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Comment not found.',
    }
  }

  await database.run(
    `
      INSERT OR IGNORE INTO comment_reports (
        comment_id,
        reporter_user_id,
        reason,
        created_at
      )
      VALUES (?, ?, ?, ?)
    `,
    [commentId, user.id, normalizeTextBlock(reason) || 'Needs review', new Date().toISOString()],
  )

  return {
    ok: true,
  }
}

export async function listAdminComments(event: H3Event, status: CommentStatus | 'all', page: number, pageSize: number) {
  const database = await useDatabase(event)
  const params: Array<string | number> = []
  let whereClause = ''

  if (status !== 'all') {
    whereClause = 'WHERE comments.status = ?'
    params.push(status)
  }

  const totalRow = await database.first<CountRow>(`SELECT COUNT(*) AS total FROM comments ${whereClause}`, params)
  const total = totalRow?.total || 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  const items = await database.all<AdminCommentRow>(
    `
      SELECT
        comments.id AS id,
        comments.article_slug AS articleSlug,
        comments.body AS body,
        comments.status AS status,
        comments.created_at AS createdAt,
        comments.updated_at AS updatedAt,
        users.id AS userId,
        users.display_name AS displayName,
        users.username AS username,
        users.provider AS provider,
        users.role AS role,
        users.comment_banned AS commentBanned,
        (
          SELECT COUNT(*)
          FROM comment_reports
          WHERE comment_reports.comment_id = comments.id
        ) AS reportCount,
        (
          SELECT reason
          FROM comment_reports
          WHERE comment_reports.comment_id = comments.id
          ORDER BY comment_reports.created_at DESC, comment_reports.id DESC
          LIMIT 1
        ) AS latestReportReason
      FROM comments
      INNER JOIN users ON users.id = comments.user_id
      ${whereClause}
      ORDER BY comments.created_at ASC, comments.id ASC
      LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset],
  )

  const articleMap = new Map(
    getContentManifest().articles
      .filter((entry) => !entry.draft)
      .map((entry) => [entry.slug, entry.title]),
  )

  return {
    page: total === 0 ? 1 : safePage,
    pageSize,
    total,
    totalPages,
    items: items.map((item) => ({
      ...item,
      articleTitle: articleMap.get(item.articleSlug) || item.articleSlug,
      commentBanned: Boolean(item.commentBanned),
    })),
  }
}

export async function moderateComment(event: H3Event, commentId: number, nextStatus: CommentStatus, note: string | null): Promise<CommentMutationResult> {
  const user = await getCurrentUser(event)
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'You must be signed in.',
    }
  }

  if (user.role !== 'admin') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Admin access is required.',
    }
  }

  const database = await useDatabase(event)
  const existing = await database.first<{ id: number }>('SELECT id FROM comments WHERE id = ? LIMIT 1', [commentId])

  if (!existing) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Comment not found.',
    }
  }

  const now = new Date().toISOString()
  await database.run(
    `
      UPDATE comments
      SET
        status = ?,
        updated_at = ?,
        last_moderated_at = ?,
        last_moderated_by = ?
      WHERE id = ?
    `,
    [nextStatus, now, now, user.id, commentId],
  )
  await createAuditLog(event, user.id, `comment.${nextStatus}`, note, commentId)

  return {
    ok: true,
  }
}

export async function deleteCommentByAdmin(event: H3Event, commentId: number, note: string | null): Promise<CommentMutationResult> {
  const user = await getCurrentUser(event)
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'You must be signed in.',
    }
  }

  if (user.role !== 'admin') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Admin access is required.',
    }
  }

  const database = await useDatabase(event)
  const existing = await database.first<{ id: number }>('SELECT id FROM comments WHERE id = ? LIMIT 1', [commentId])

  if (!existing) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Comment not found.',
    }
  }

  await createAuditLog(event, user.id, 'comment.delete', note, commentId)
  await database.run('DELETE FROM comment_reports WHERE comment_id = ?', [commentId])
  await database.run('DELETE FROM comments WHERE id = ?', [commentId])

  return {
    ok: true,
  }
}

export async function banUserFromComments(event: H3Event, targetUserId: number, note: string | null): Promise<CommentMutationResult> {
  const user = await getCurrentUser(event)
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'You must be signed in.',
    }
  }

  if (user.role !== 'admin') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Admin access is required.',
    }
  }

  const database = await useDatabase(event)
  const existing = await database.first<{ id: number }>('SELECT id FROM users WHERE id = ? LIMIT 1', [targetUserId])

  if (!existing) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'User not found.',
    }
  }

  const now = new Date().toISOString()
  await database.run('UPDATE users SET comment_banned = 1, updated_at = ? WHERE id = ?', [now, targetUserId])
  await database.run('UPDATE sessions SET invalidated_at = ? WHERE user_id = ? AND invalidated_at IS NULL', [now, targetUserId])
  await createAuditLog(event, user.id, 'user.comment_ban', note, null)

  return {
    ok: true,
  }
}
