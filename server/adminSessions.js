/**
 * server/adminSessions.js — Sessions de admin sin estado (HMAC con secreto compartido).
 * El token es `iat.nonce.sig`; expire tras TTL tras la verificación del consumidor.
 * El secreto compartido = ADMIN_SESSION_SECRET (o CRON_SECRET) — válido entre instancias de Vercel.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { safeCompareSecret } from './hub/security.js'

/** @param {string} secret */
function hmacKey(secret) {
  const key = (secret || '').trim()
  if (!key) throw new Error('ADMIN_SESSION_SECRET no configurada')
  return key
}

/** @returns {string} token firmado */
export function makeAdminSessionToken(secret) {
  const key = hmacKey(secret)
  const iat = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const raw = `${iat}.${nonce}`
  const sig = createHmac('sha256', key).update(raw).digest('base64url')
  return `${raw}.${sig}`
}

/**
 * @param {string} token
 * @param {string} secret
 * @returns {number|null} issuedAt si el token es válido, null si no
 */
export function verifyAdminSessionToken(token, secret, { ttlMs = 8 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const key = hmacKey(secret)
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [iatStr, nonce, sig] = parts
  const expected = createHmac('sha256', key).update(`${iatStr}.${nonce}`).digest('base64url')
  if (!safeCompareSecret(sig, expected)) return null
  const iat = Number(iatStr)
  if (!Number.isFinite(iat) || now() - iat > ttlMs) return null
  return iat
}
