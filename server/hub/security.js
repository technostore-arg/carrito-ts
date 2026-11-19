/**
 * server/hub/security.js — Utilidades de seguridad reutilizables (ESM, JSDoc).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Comparación en tiempo constante de secretos/tokens. */
export function safeCompareSecret(a, b) {
  const ba = Buffer.from(String(a ?? ''))
  const bb = Buffer.from(String(b ?? ''))
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Rate limiter en memoria con ventana deslizante (por IP).
 * En serverless es por instancia; suficiente para frenar abuso basic.
 */
export function createRateLimiter({ max = 15, windowMs = 60_000, now = () => Date.now() } = {}) {
  /** @type {Map<string, number[]>} */
  const hits = new Map()
  return {
    check(key) {
      const t = now()
      const arr = (hits.get(String(key)) || []).filter(ts => t - ts < windowMs)
      const allowed = arr.length < max
      if (allowed) arr.push(t)
      hits.set(String(key), arr)
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] >= windowMs) hits.delete(k)
      }
      return {
        allowed,
        remaining: Math.max(0, max - arr.length),
        retryAfterMs: allowed ? 0 : Math.max(0, (arr[0] || t) + windowMs - t),
      }
    },
  }
}

/** Middleware Express para rate limiting por IP. */
export function rateLimitMiddleware(limiter, keyFn = req => req.ip || req.socket?.remoteAddress || 'unknown') {
  return (req, res, next) => {
    const result = limiter.check(keyFn(req))
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      return res.status(429).json({ error: 'Demasiadas solicitudes. Probá nuevamente en unos segundos.' })
    }
    next()
  }
}

function hmacKey(secret, name) {
  const key = (secret || '').trim()
  if (!key) throw new Error(name + ' no configurada')
  return key
}

/** OAuth state firmado (anti-CSRF), válido 10 minutos por defecto. */
export function signOAuthState(secret, { nonce = randomBytes(8).toString('hex'), ts = Date.now() } = {}) {
  const payload = Buffer.from(JSON.stringify({ nonce, ts })).toString('base64url')
  const sig = createHmac('sha256', hmacKey(secret, 'CRON_SECRET')).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** @returns {boolean} */
export function verifyOAuthState(state, secret, { maxAgeMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  try {
    const [payload, sig] = String(state || '').split('.')
    if (!payload || !sig) return false
    if (!safeCompareSecret(sig, createHmac('sha256', hmacKey(secret, 'CRON_SECRET')).update(payload).digest('base64url'))) return false
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number.isFinite(data.ts) && now() - data.ts <= maxAgeMs && now() >= data.ts - 60_000
  } catch {
    return false
  }
}

/** Verifica X-Hub-Signature-256 de WhatsApp Cloud API. */
export function verifyWhatsappSignature(rawBody, signature, secret) {
  if (!secret) return true
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody || '').digest('hex')}`
  return safeCompareSecret(signature, expected)
}

/** Zero-trust: el user_id del webhook debe coincidir con ML_SELLER_ID. */
export function validateMlWebhookPayload(payload, sellerId) {
  if (!sellerId) return { valid: true }
  const values = [payload?.user_id, payload?.seller_id, payload?.data?.user_id]
    .filter(v => v != null && v !== '')
    .map(String)
  if (!values.length) return { valid: false, reason: 'MISSING_USER_ID' }
  return values.includes(String(sellerId)) ? { valid: true } : { valid: false, reason: 'SELLER_MISMATCH' }
}
