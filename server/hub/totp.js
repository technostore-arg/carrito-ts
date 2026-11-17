/**
 * server/hub/totp.js — TOTP RFC 6238 (Google Authenticator / 1Password)
 * usando sólo node:crypto, sin dependencias.
 */
import { createHmac, randomBytes } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out = []
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch)
    if (index < 0) continue
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** Secreto aleatorio en Base32 (20 bytes = 160 bits). */
export function generateTotpSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}

/** Código TOTP para un timestamp dado (testeable). */
export function totpCode(secret, { step = 30, digits = 6, now = Date.now() } = {}) {
  const counter = Math.floor(now / 1000 / step)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(binary % (10 ** digits)).padStart(digits, '0')
}

/** Verifica con tolerancia de ±1 período (reloj del celular). */
export function verifyTotp(code, secret, { window = 1, now = Date.now() } = {}) {
  const provided = String(code || '').replace(/\D/g, '')
  if (!/^\d{6}$/.test(provided) || !secret) return false
  const stepMs = 30_000
  for (let delta = -window; delta <= window; delta++) {
    if (provided === totpCode(secret, { now: now + delta * stepMs })) return true
  }
  return false
}

/** URI para importar en la app de autenticación. */
export function totpUri(secret, account = 'admin@technostore.ar', issuer = 'TechnoStore') {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

/** Secreto agrupado de a 4 caracteres para leerlo más fácil. */
export function formatTotpSecret(secret) {
  return String(secret || '').match(/.{1,4}/g)?.join(' ') || ''
}
