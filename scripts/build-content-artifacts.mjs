import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { extname, isAbsolute, join, resolve, relative } from 'node:path'
import matter from 'gray-matter'

const root = process.cwd()
const contentRoot = resolve(root, 'content')
const outputRoot = resolve(root, 'generated')
const validateOnly = process.argv.includes('--validate-only')

const absoluteUrlPattern = /^https?:\/\//i
const slugPattern = /^[a-z0-9-]+$/
const remoteLinkTypes = new Set(['r2', 'oss', 'webdav'])
const allowedPlatforms = new Set(['windows', 'macos', 'linux', 'android', 'ios', 'universal'])
const allowedStatuses = new Set(['active', 'hidden', 'archived'])

function fail(message) {
  throw new Error(message)
}

function ensure(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function slugFromFile(filePath) {
  return filePath.replace(/\\/g, '/').replace(/\.md$/i, '').split('/').pop()
}

async function walkMarkdown(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)))
      continue
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(fullPath)
    }
  }

  return files
}

async function readCollection(collection) {
  const directory = join(contentRoot, collection)
  const files = await walkMarkdown(directory)

  return Promise.all(
    files.map(async (filePath) => {
      const source = await readFile(filePath, 'utf8')
      const parsed = matter(source)
      return {
        collection,
        filePath,
        relativePath: relative(root, filePath).replace(/\\/g, '/'),
        body: parsed.content.trim(),
        data: parsed.data,
      }
    }),
  )
}

function toPublicUrl(collection, slug) {
  if (collection === 'pages' && slug === 'about') {
    return '/about'
  }

  if (collection === 'pages') {
    return `/${slug}`
  }

  if (collection === 'changelog') {
    return '/changelog'
  }

  return `/${collection}/${slug}`
}

function validateArticle(entry) {
  const data = entry.data
  const expectedSlug = slugFromFile(entry.relativePath)

  ensure(typeof data.title === 'string' && data.title.trim(), `${entry.relativePath}: title is required`)
  ensure(typeof data.slug === 'string' && slugPattern.test(data.slug), `${entry.relativePath}: slug must match /^[a-z0-9-]+$/`)
  ensure(data.slug === expectedSlug, `${entry.relativePath}: slug must match filename "${expectedSlug}"`)
  ensure(typeof data.summary === 'string' && data.summary.trim(), `${entry.relativePath}: summary is required`)
  ensure(data.summary.length <= 240, `${entry.relativePath}: summary must be 240 chars or fewer`)
  ensure(typeof data.draft === 'boolean', `${entry.relativePath}: draft must be boolean`)
  ensure(isValidDate(data.publishedAt), `${entry.relativePath}: publishedAt must be a valid date`)
  ensure(!data.updatedAt || isValidDate(data.updatedAt), `${entry.relativePath}: updatedAt must be a valid date`)
  ensure(normalizeArray(data.tags).every((tag) => typeof tag === 'string' && tag === tag.toLowerCase()), `${entry.relativePath}: tags must be lowercase strings`)

  return {
    title: data.title.trim(),
    slug: data.slug,
    summary: data.summary.trim(),
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt || null,
    draft: data.draft,
    category: data.category || null,
    tags: normalizeArray(data.tags),
    cover: data.cover || null,
    authors: normalizeArray(data.authors),
    relatedDownloads: normalizeArray(data.relatedDownloads),
    url: toPublicUrl('articles', data.slug),
  }
}

function validateDownload(entry) {
  const data = entry.data
  const expectedSlug = slugFromFile(entry.relativePath)

  ensure(typeof data.title === 'string' && data.title.trim(), `${entry.relativePath}: title is required`)
  ensure(typeof data.slug === 'string' && slugPattern.test(data.slug), `${entry.relativePath}: slug must match /^[a-z0-9-]+$/`)
  ensure(data.slug === expectedSlug, `${entry.relativePath}: slug must match filename "${expectedSlug}"`)
  ensure(typeof data.summary === 'string' && data.summary.trim(), `${entry.relativePath}: summary is required`)
  ensure(isValidDate(data.publishedAt), `${entry.relativePath}: publishedAt must be a valid date`)
  ensure(!data.updatedAt || isValidDate(data.updatedAt), `${entry.relativePath}: updatedAt must be a valid date`)
  ensure(allowedStatuses.has(data.status), `${entry.relativePath}: status must be active|hidden|archived`)
  ensure(Array.isArray(data.versions) && data.versions.length > 0, `${entry.relativePath}: versions must be a non-empty array`)

  const seenVersions = new Set()
  const versions = data.versions.map((version, versionIndex) => {
    ensure(typeof version.version === 'string' && version.version.trim(), `${entry.relativePath}: versions[${versionIndex}].version is required`)
    ensure(!seenVersions.has(version.version), `${entry.relativePath}: duplicate version "${version.version}"`)
    seenVersions.add(version.version)
    ensure(typeof version.label === 'string' && version.label.trim(), `${entry.relativePath}: versions[${versionIndex}].label is required`)
    ensure(Array.isArray(version.files) && version.files.length > 0, `${entry.relativePath}: versions[${versionIndex}].files must be non-empty`)

    const seenFileIds = new Set()
    const files = version.files.map((file, fileIndex) => {
      ensure(typeof file.id === 'string' && slugPattern.test(file.id), `${entry.relativePath}: file id must be lowercase slug format`)
      ensure(!seenFileIds.has(file.id), `${entry.relativePath}: duplicate file id "${file.id}" in version "${version.version}"`)
      seenFileIds.add(file.id)
      ensure(typeof file.name === 'string' && file.name.trim(), `${entry.relativePath}: ${version.version}.files[${fileIndex}].name is required`)
      ensure(allowedPlatforms.has(file.platform), `${entry.relativePath}: ${version.version}.files[${fileIndex}].platform is invalid`)
      ensure(Number.isInteger(file.size) && file.size >= 0, `${entry.relativePath}: ${version.version}.files[${fileIndex}].size must be integer bytes`)
      ensure(Array.isArray(file.links) && file.links.length > 0, `${entry.relativePath}: ${version.version}.files[${fileIndex}].links must be non-empty`)

      const links = file.links.map((link, linkIndex) => {
        ensure(typeof link.label === 'string' && link.label.trim(), `${entry.relativePath}: link label is required`)
        ensure(Number.isInteger(link.order), `${entry.relativePath}: link order must be an integer`)

        if (remoteLinkTypes.has(link.type)) {
          ensure(typeof link.url === 'string' && absoluteUrlPattern.test(link.url), `${entry.relativePath}: ${link.type} url must be absolute`)
        }

        if (link.type === 'github_repo') {
          ensure(typeof link.owner === 'string' && link.owner.trim(), `${entry.relativePath}: github_repo owner is required`)
          ensure(typeof link.repo === 'string' && link.repo.trim(), `${entry.relativePath}: github_repo repo is required`)
          ensure(typeof link.ref === 'string' && link.ref.trim(), `${entry.relativePath}: github_repo ref is required`)
          ensure(typeof link.path === 'string' && link.path.trim(), `${entry.relativePath}: github_repo path is required`)
        }

        if (link.type === 'local') {
          ensure(typeof link.path === 'string' && link.path.trim(), `${entry.relativePath}: local path is required`)
          ensure(!isAbsolute(link.path), `${entry.relativePath}: local path must be relative`)
          ensure(
            !link.path.replace(/\\/g, '/').split('/').some((segment) => segment === '..'),
            `${entry.relativePath}: local path must not escape LOCAL_STORAGE_ROOT`,
          )
        }

        return link
      })

      return {
        id: file.id,
        name: file.name.trim(),
        platform: file.platform,
        size: file.size,
        arch: file.arch || null,
        links,
      }
    })

    return {
      version: version.version.trim(),
      label: version.label.trim(),
      files,
    }
  })

  return {
    title: data.title.trim(),
    slug: data.slug,
    summary: data.summary.trim(),
    publishedAt: data.publishedAt,
    updatedAt: data.updatedAt || null,
    status: data.status,
    category: data.category || null,
    tags: normalizeArray(data.tags),
    cover: data.cover || null,
    articleSlug: data.articleSlug || null,
    versions,
    url: toPublicUrl('downloads', data.slug),
  }
}

function validatePage(entry, collection) {
  const data = entry.data
  const expectedSlug = slugFromFile(entry.relativePath)

  ensure(typeof data.title === 'string' && data.title.trim(), `${entry.relativePath}: title is required`)
  ensure(typeof data.slug === 'string' && slugPattern.test(data.slug), `${entry.relativePath}: slug must match /^[a-z0-9-]+$/`)
  ensure(data.slug === expectedSlug, `${entry.relativePath}: slug must match filename "${expectedSlug}"`)
  ensure(typeof data.summary === 'string' && data.summary.trim(), `${entry.relativePath}: summary is required`)
  ensure(data.summary.length <= 240, `${entry.relativePath}: summary must be 240 chars or fewer`)
  ensure(!data.publishedAt || isValidDate(data.publishedAt), `${entry.relativePath}: publishedAt must be a valid date`)
  ensure(!data.updatedAt || isValidDate(data.updatedAt), `${entry.relativePath}: updatedAt must be a valid date`)

  return {
    title: data.title.trim(),
    slug: data.slug,
    summary: data.summary.trim(),
    publishedAt: data.publishedAt || null,
    updatedAt: data.updatedAt || null,
    url: toPublicUrl(collection, data.slug),
  }
}

function buildSearchIndex({ articles, downloads }) {
  const items = []

  for (const article of articles.filter((entry) => !entry.draft)) {
    items.push({
      kind: 'article',
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      tags: article.tags,
      url: article.url,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    })
  }

  for (const download of downloads.filter((entry) => entry.status === 'active')) {
    items.push({
      kind: 'download',
      title: download.title,
      slug: download.slug,
      summary: download.summary,
      tags: download.tags,
      url: download.url,
      publishedAt: download.publishedAt,
      updatedAt: download.updatedAt,
      matchedVersions: download.versions.map((version) => version.version),
      matchedFiles: download.versions.flatMap((version) => version.files.map((file) => file.name)),
    })
  }

  return items
}

async function main() {
  const [articleEntries, downloadEntries, pageEntries, changelogEntries] = await Promise.all([
    readCollection('articles'),
    readCollection('downloads'),
    readCollection('pages'),
    readCollection('changelog').catch(() => []),
  ])

  const articles = articleEntries.map(validateArticle)
  const downloads = downloadEntries.map(validateDownload)
  const pages = pageEntries.map((entry) => validatePage(entry, 'pages'))
  const changelog = changelogEntries.map((entry) => validatePage(entry, 'changelog'))

  const articleSlugs = new Set()
  for (const article of articles) {
    ensure(!articleSlugs.has(article.slug), `duplicate article slug "${article.slug}"`)
    articleSlugs.add(article.slug)
  }

  const downloadSlugs = new Set()
  for (const download of downloads) {
    ensure(!downloadSlugs.has(download.slug), `duplicate download slug "${download.slug}"`)
    downloadSlugs.add(download.slug)
    if (download.articleSlug) {
      ensure(articleSlugs.has(download.articleSlug), `download "${download.slug}" references missing articleSlug "${download.articleSlug}"`)
    }
  }

  for (const article of articles) {
    for (const relatedSlug of article.relatedDownloads) {
      ensure(downloadSlugs.has(relatedSlug), `article "${article.slug}" references missing relatedDownloads slug "${relatedSlug}"`)
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    articles,
    downloads,
    pages,
    changelog,
  }

  const searchIndex = {
    generatedAt: manifest.generatedAt,
    items: buildSearchIndex({ articles, downloads }),
  }

  if (validateOnly) {
    console.log(`Validated ${articles.length} articles, ${downloads.length} downloads, ${pages.length} pages, ${changelog.length} changelog entries.`)
    return
  }

  await mkdir(outputRoot, { recursive: true })
  await writeFile(join(outputRoot, 'content-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(join(outputRoot, 'search-index.json'), `${JSON.stringify(searchIndex, null, 2)}\n`, 'utf8')
  console.log(`Generated content manifest and search index at ${relative(root, outputRoot)}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
