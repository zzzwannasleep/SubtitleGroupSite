export function extractApiErrorMessage(error: unknown, fallback = 'Request failed.') {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const maybeError = error as {
    message?: string
    statusMessage?: string
    data?: {
      error?: {
        message?: string
      }
      message?: string
    }
  }

  return (
    maybeError.data?.error?.message ||
    maybeError.data?.message ||
    maybeError.statusMessage ||
    maybeError.message ||
    fallback
  )
}
