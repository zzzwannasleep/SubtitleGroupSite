const encoder = new TextEncoder()
const hmacKeyCache = new Map<string, Promise<CryptoKey>>()

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value))
    .map((entry) => entry.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToBase64Url(bytes: Uint8Array) {
  const base64 = Buffer.from(bytes).toString('base64')
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

async function getHmacKey(secret: string) {
  if (!hmacKeyCache.has(secret)) {
    hmacKeyCache.set(
      secret,
      crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        {
          name: 'HMAC',
          hash: 'SHA-256',
        },
        false,
        ['sign'],
      ),
    )
  }

  return hmacKeyCache.get(secret)!
}

export function isPlaceholderValue(value?: string | null) {
  if (!value) {
    return true
  }

  return value.startsWith('replace-with-')
}

export async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

export async function hmacSha256Hex(secret: string, value: string) {
  const key = await getHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return bytesToHex(signature)
}

export function createRandomToken(size = 32) {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export function normalizeTextBlock(value: string) {
  return value.replace(/\r\n/g, '\n').trim()
}

export function normalizeIndexText(value: string) {
  return normalizeTextBlock(value).toLowerCase().replace(/\s+/gu, ' ')
}
