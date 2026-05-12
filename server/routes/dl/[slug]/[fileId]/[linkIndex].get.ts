import { createError, getRouterParam, sendRedirect, sendStream, setHeader } from 'h3'
import { getDownloadLinkForAccess, recordDownloadClick, resolveLocalDownloadFile } from '~/server/utils/downloads'
import { resolveDirectLinkHref } from '~/utils/downloads'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const fileId = getRouterParam(event, 'fileId')
  const rawLinkIndex = getRouterParam(event, 'linkIndex')
  const linkIndex = Number.parseInt(rawLinkIndex || '', 10)

  if (!slug || !fileId || !Number.isInteger(linkIndex) || linkIndex < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid download link request',
    })
  }

  const { file, link } = getDownloadLinkForAccess(slug, fileId, linkIndex)

  try {
    await recordDownloadClick(event, {
      slug,
      fileId,
      linkIndex,
      link,
    })
  } catch (error) {
    console.error('[download-click]', error)
  }

  if (link.type !== 'local') {
    const target = resolveDirectLinkHref(link)

    if (!target) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Download target is unavailable',
      })
    }

    return sendRedirect(event, target, 302)
  }

  const { absolutePath } = await resolveLocalDownloadFile(link.path)
  const [{ createReadStream }, { stat }] = await Promise.all([
    import('node:fs'),
    import('node:fs/promises'),
  ])
  const fileStat = await stat(absolutePath)

  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Length', String(fileStat.size))
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
  setHeader(event, 'Cache-Control', 'private, no-store')

  return sendStream(event, createReadStream(absolutePath))
})
