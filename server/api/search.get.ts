import { getQuery } from 'h3'
import { getSearchIndex } from '~/server/utils/content-data'

type SearchItem = {
  kind: 'article' | 'download'
  title: string
  slug: string
  summary: string
  tags: string[]
  url: string
  publishedAt?: string | null
  updatedAt?: string | null
  matchedVersions?: string[]
  matchedFiles?: string[]
}

function normalize(value: string) {
  return value.toLowerCase().trim()
}

function scoreItem(item: SearchItem, rawQuery: string) {
  const query = normalize(rawQuery)
  const title = normalize(item.title)
  const summary = normalize(item.summary)
  const tags = item.tags.map(normalize)
  const versions = (item.matchedVersions || []).map(normalize)
  const files = (item.matchedFiles || []).map(normalize)

  let score = 0
  const matchedVersions = item.matchedVersions?.filter((version) => normalize(version).includes(query)) || []
  const matchedFiles = item.matchedFiles?.filter((file) => normalize(file).includes(query)) || []

  if (title === query) {
    score += 120
  }

  if (title.startsWith(query)) {
    score += 100
  }

  if (title.includes(query)) {
    score += 80
  }

  if (tags.some((tag) => tag.includes(query))) {
    score += 60
  }

  if (summary.includes(query)) {
    score += 40
  }

  if (versions.some((version) => version.includes(query))) {
    score += 20
  }

  if (files.some((file) => file.includes(query))) {
    score += 10
  }

  return {
    ...item,
    score,
    matchedVersions,
    matchedFiles,
  }
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''
  const type = query.type === 'articles' || query.type === 'downloads' ? query.type : 'all'
  const page = Math.max(1, Number.parseInt(typeof query.page === 'string' ? query.page : '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(typeof query.pageSize === 'string' ? query.pageSize : '20', 10) || 20))

  if (!q) {
    return {
      ok: true,
      data: {
        q: '',
        type,
        page: 1,
        pageSize,
        total: 0,
        totalPages: 0,
        items: [],
      },
    }
  }

  const items = getSearchIndex().items as SearchItem[]
  const filtered = items
    .filter((item) => {
      if (type === 'articles') {
        return item.kind === 'article'
      }

      if (type === 'downloads') {
        return item.kind === 'download'
      }

      return true
    })
    .map((item) => scoreItem(item, q))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      const rightDate = right.updatedAt || right.publishedAt || ''
      const leftDate = left.updatedAt || left.publishedAt || ''
      return rightDate.localeCompare(leftDate)
    })

  const total = filtered.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1
  const start = (safePage - 1) * pageSize

  return {
    ok: true,
    data: {
      q,
      type,
      page: total === 0 ? 1 : safePage,
      pageSize,
      total,
      totalPages,
      items: filtered.slice(start, start + pageSize).map(({ score, ...item }) => item),
    },
  }
})

