import type { H3Event } from 'h3'
import { createError, getRequestHeader, getRequestIP } from 'h3'
import { getContentManifest } from '~/server/utils/content-data'
import { hmacSha256Hex } from '~/server/utils/crypto'
import { useDatabase } from '~/server/utils/database'
import type { DownloadLink, PublicDownloadLink } from '~/utils/downloads'
import { isLinkEnabledForDeployMode, resolveDirectLinkHref, sortDownloadLinksWithIndex } from '~/utils/downloads'

type ManifestDownload = ReturnType<typeof getContentManifest>['downloads'][number]
type ManifestDownloadFile = ManifestDownload['versions'][number]['files'][number]

function getRuntimeDeployMode() {
  const runtimeConfig = useRuntimeConfig()
  return process.env.DEPLOY_MODE || runtimeConfig.public.deployMode || 'local'
}

function isLocalStorageEnabled() {
  const runtimeConfig = useRuntimeConfig()
  const raw = process.env.LOCAL_STORAGE_ENABLE || runtimeConfig.public.localStorageEnable || 'false'
  return raw === 'true'
}

function getLocalStorageRoot() {
  const runtimeConfig = useRuntimeConfig()
  return process.env.LOCAL_STORAGE_ROOT || runtimeConfig.localStorageRoot || ''
}

function getSessionHashSecret() {
  const runtimeConfig = useRuntimeConfig()
  return process.env.AUTH_SESSION_SECRET || runtimeConfig.authSessionSecret || 'subtitle-group-site'
}

export function buildDownloadAccessHref(slug: string, fileId: string, linkIndex: number) {
  return `/dl/${encodeURIComponent(slug)}/${encodeURIComponent(fileId)}/${linkIndex}`
}

export function serializePublicDownloadLinks(slug: string, fileId: string, links: DownloadLink[]): PublicDownloadLink[] {
  const deployMode = getRuntimeDeployMode()
  const localStorageEnabled = isLocalStorageEnabled()

  return sortDownloadLinksWithIndex(links)
    .filter(({ link }) => isLinkEnabledForDeployMode(link, deployMode, localStorageEnabled))
    .map(({ index, link }) => ({
      id: String(index),
      type: link.type,
      label: link.label,
      order: link.order,
      href: buildDownloadAccessHref(slug, fileId, index),
    }))
}

export function serializeDownloadSummary(item: ManifestDownload) {
  return {
    title: item.title,
    slug: item.slug,
    summary: item.summary,
    category: item.category,
    tags: item.tags,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    versions: item.versions.map((version) => version.version),
    url: item.url,
  }
}

export function serializeDownloadDetail<T extends { slug: string; versions: Array<{ version: string; label: string; files: Array<{ id: string; name: string; platform: string; size: number; arch?: string | null; links: DownloadLink[] }> }> }>(item: T) {
  return {
    ...item,
    url: (item as T & { url?: string }).url || `/downloads/${item.slug}`,
    versions: item.versions.map((version) => ({
      ...version,
      files: version.files.map((file) => ({
        ...file,
        links: serializePublicDownloadLinks(item.slug, file.id, file.links),
      })),
    })),
  }
}

export function listDownloadSummaries(filters?: { tag?: string; slugs?: string[] }) {
  const tag = filters?.tag?.trim()
  const slugs = (filters?.slugs || []).map((value) => value.trim()).filter(Boolean)
  const slugOrder = new Map(slugs.map((value, index) => [value, index]))
  const slugSet = new Set(slugs)

  const items = getContentManifest().downloads.filter((item) => {
    if (item.status !== 'active') {
      return false
    }

    if (tag && !item.tags.includes(tag)) {
      return false
    }

    if (slugSet.size > 0 && !slugSet.has(item.slug)) {
      return false
    }

    return true
  })

  items.sort((left, right) => {
    if (slugOrder.size > 0) {
      return (slugOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) - (slugOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER)
    }

    return right.publishedAt.localeCompare(left.publishedAt)
  })

  return items.map(serializeDownloadSummary)
}

export function findActiveDownload(slug: string) {
  return getContentManifest().downloads.find((item) => item.slug === slug && item.status === 'active') || null
}

export function findDownloadFile(download: ManifestDownload, fileId: string) {
  return download.versions.flatMap((version) => version.files).find((file) => file.id === fileId) || null
}

export function getDownloadLinkForAccess(slug: string, fileId: string, linkIndex: number) {
  const download = findActiveDownload(slug)

  if (!download) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Download not found',
    })
  }

  const file = findDownloadFile(download, fileId)

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File not found',
    })
  }

  const link = file.links[linkIndex]

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  if (!isLinkEnabledForDeployMode(link, getRuntimeDeployMode(), isLocalStorageEnabled())) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not available in this deploy mode',
    })
  }

  return {
    download,
    file,
    link,
  }
}

export async function resolveLocalDownloadFile(relativePath: string) {
  if (getRuntimeDeployMode() !== 'local' || !isLocalStorageEnabled()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Local downloads are not enabled',
    })
  }

  const root = getLocalStorageRoot().trim()

  if (!root) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LOCAL_STORAGE_ROOT is not configured',
    })
  }

  const [{ access, stat }, pathModule] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const normalizedInput = relativePath.trim()

  if (!normalizedInput) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Local file path is empty',
    })
  }

  if (pathModule.isAbsolute(normalizedInput)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Absolute local file paths are not allowed',
    })
  }

  const resolvedRoot = pathModule.resolve(root)
  const resolvedPath = pathModule.resolve(resolvedRoot, normalizedInput)
  const relativeToRoot = pathModule.relative(resolvedRoot, resolvedPath)

  if (
    !relativeToRoot
      ? false
      : relativeToRoot.startsWith('..')
        || pathModule.isAbsolute(relativeToRoot)
  ) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Local file path escapes LOCAL_STORAGE_ROOT',
    })
  }

  try {
    await access(resolvedPath)
    const fileStat = await stat(resolvedPath)

    if (!fileStat.isFile()) {
      throw new Error('not a file')
    }
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'Local file not found',
    })
  }

  return {
    absolutePath: resolvedPath,
  }
}

export async function recordDownloadClick(
  event: H3Event,
  payload: {
    slug: string
    fileId: string
    linkIndex: number
    link: DownloadLink
  },
) {
  const requestIp = getRequestIP(event, { xForwardedFor: true })
  const ipHash = requestIp ? await hmacSha256Hex(getSessionHashSecret(), `download-ip:${requestIp}`) : null
  const userAgent = getRequestHeader(event, 'user-agent')?.slice(0, 512) || null
  const targetUrl = resolveDirectLinkHref(payload.link)
  const database = await useDatabase(event)

  await database.run(
    `
      INSERT INTO download_clicks (
        download_slug,
        file_id,
        link_index,
        link_type,
        link_label,
        target_url,
        created_at,
        ip_hash,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.slug,
      payload.fileId,
      payload.linkIndex,
      payload.link.type,
      payload.link.label,
      targetUrl,
      new Date().toISOString(),
      ipHash,
      userAgent,
    ],
  )
}

export async function listDownloadClickCounts(event: H3Event) {
  const database = await useDatabase(event)

  return database.all<{
    downloadSlug: string
    fileId: string
    linkIndex: number
    linkType: string
    total: number
  }>(
    `
      SELECT
        download_slug AS downloadSlug,
        file_id AS fileId,
        link_index AS linkIndex,
        link_type AS linkType,
        COUNT(*) AS total
      FROM download_clicks
      GROUP BY download_slug, file_id, link_index, link_type
      ORDER BY total DESC, download_slug ASC, file_id ASC, link_index ASC
    `,
  )
}
