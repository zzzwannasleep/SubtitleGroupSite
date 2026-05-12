import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TURNSTILE_FAILED'
  | 'OAUTH_STATE_INVALID'
  | 'TELEGRAM_SIGNATURE_INVALID'
  | 'CONTENT_VALIDATION_FAILED'
  | 'INTERNAL_ERROR'

export function apiOk<T>(data: T) {
  return {
    ok: true as const,
    data,
  }
}

export function apiError(event: H3Event, statusCode: number, code: ApiErrorCode, message: string) {
  setResponseStatus(event, statusCode)

  return {
    ok: false as const,
    error: {
      code,
      message,
    },
  }
}

export function statusCodeFromError(code: ApiErrorCode) {
  switch (code) {
    case 'INVALID_INPUT':
    case 'CONTENT_VALIDATION_FAILED':
    case 'OAUTH_STATE_INVALID':
    case 'TELEGRAM_SIGNATURE_INVALID':
    case 'TURNSTILE_FAILED':
      return 400
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'RATE_LIMITED':
      return 429
    default:
      return 500
  }
}

export function parsePositiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(typeof value === 'string' ? value : '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.min(parsed, max)
}
