function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) {
    return escapeHtml(text)
  }

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(${escapedKeyword})`, 'ig')
  return escapeHtml(text).replace(pattern, '<mark class="result-mark">$1</mark>')
}

