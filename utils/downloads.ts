type RemoteLink = {
  type: 'r2' | 'oss' | 'webdav'
  label: string
  url: string
  order: number
}

type GithubRepoLink = {
  type: 'github_repo'
  label: string
  owner: string
  repo: string
  ref: string
  path: string
  order: number
}

type LocalLink = {
  type: 'local'
  label: string
  path: string
  order: number
}

type DownloadLink = RemoteLink | GithubRepoLink | LocalLink

export function resolveLinkHref(link: DownloadLink) {
  if (link.type === 'github_repo') {
    return `https://raw.githubusercontent.com/${link.owner}/${link.repo}/${link.ref}/${encodeURI(link.path)}`
  }

  if (link.type === 'local') {
    return null
  }

  return link.url
}

export function resolveOrderedLinks(links: DownloadLink[]) {
  return [...links]
    .sort((left, right) => right.order - left.order)
    .map((link) => ({
      ...link,
      href: resolveLinkHref(link),
    }))
}

