/**
 * Test: rateLimitMiddleware usa X-Forwarded-For como clave.
 * Antes: clave = req.ip → en Vercel (sin trust proxy) un solo bucket para todos los usuarios.
 * Después: claves diferentes por XFF diferente.
 */
import assert from 'node:assert/strict'
import { createRateLimiter, rateLimitMiddleware } from '../server/hub/security.js'

function mkReq(ip, xff) {
  return { ip, socket: { remoteAddress: ip }, headers: (xff ? { 'x-forwarded-for': xff } : {}), method: 'POST' }
}
function run(mw, req) {
  let status = 'ok'
  const res = { setHeader: () => {}, status: s => { status = String(s); return res }, json: () => {} }
  mw(req, res, () => {})
  return status
}

const limiter = createRateLimiter({ max: 1, windowMs: 1000 })
const mw = rateLimitMiddleware(limiter)
const reqA = mkReq('9.9.9.9', '1.2.3.4')
const reqB = mkReq('9.9.9.9', '5.6.7.8')
assert.equal(run(mw, reqA), 'ok')
assert.equal(run(mw, reqB), 'ok') // distinto XFF: no debe estar bloqueado
assert.equal(run(mw, reqA), '429') // mismo XFF: bloqueado
console.log('TEST rate-limit-keys OK')
