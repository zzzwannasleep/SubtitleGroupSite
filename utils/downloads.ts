export type RemoteLink = {
  type: 'r2' | 'oss' | 'webdav'
  label: string
  url: string
  order: number
}

export type GithubRepoLink = {
  type: 'github_repo'
  label: string
  owner: string
  repo: string
  ref: string
  path: string
  order: number
}

export type LocalLink = {
  type: 'local'
  label: string
  path: string
  order: number
}

export type DownloadLink = RemoteLink | GithubRepoLink | LocalLink

export type PublicDownloadLink = {
  id: string
  type: DownloadLink['type']
  label: string
  order: number
  href: string
}

export function isLinkEnabledForDeployMode(link: DownloadLink, deployMode: string, localStorageEnabled = false) {
  if (link.type !== 'local') {
    return true
  }

  return deployMode === 'local' && localStorageEnabled
}

export function resolveDirectLinkHref(link: DownloadLink) {
  if (link.type === 'github_repo') {
    return `https://raw.githubusercontent.com/${link.owner}/${link.repo}/${link.ref}/${encodeURI(link.path)}`
  }

  if (link.type === 'local') {
    return null
  }

  return link.url
}

export function sortDownloadLinks(links: DownloadLink[]) {
  return [...links].sort((left, right) => right.order - left.order)
}

export function sortDownloadLinksWithIndex(links: DownloadLink[]) {
  return links
    .map((link, index) => ({
      index,
      link,
    }))
    .sort((left, right) => right.link.order - left.link.order)
}

export function resolveOrderedLinks(links: DownloadLink[]) {
  return sortDownloadLinks(links)
    .map((link) => ({
      ...link,
      href: resolveDirectLinkHref(link),
    }))
}
