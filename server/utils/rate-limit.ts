type RateLimitBucket = {
  count: number
  resetAt: number
}

const globalStore = globalThis as {
  __subtitleGroupRateLimitBuckets?: Map<string, RateLimitBucket>
}

const buckets = globalStore.__subtitleGroupRateLimitBuckets || new Map<string, RateLimitBucket>()
globalStore.__subtitleGroupRateLimitBuckets = buckets

function cleanupBuckets(now: number) {
  if (buckets.size < 1024) {
    return
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  cleanupBuckets(now)

  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    const next = {
      count: 1,
      resetAt: now + windowMs,
    }
    buckets.set(key, next)

    return {
      ok: true,
      remaining: Math.max(0, limit - next.count),
      resetAt: next.resetAt,
    }
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: current.resetAt,
    }
  }

  current.count += 1
  buckets.set(key, current)

  return {
    ok: true,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  }
}
