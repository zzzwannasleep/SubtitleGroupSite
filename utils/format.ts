const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatDate(value?: string | null) {
  if (!value) {
    return '未标注'
  }

  return dateFormatter.format(new Date(value))
}

export function formatBytes(bytes: number) {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const base = Math.floor(Math.log(bytes) / Math.log(1024))
  const next = bytes / 1024 ** base

  return `${next.toFixed(next >= 100 || base === 0 ? 0 : 1)} ${units[base]}`
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value)
}

