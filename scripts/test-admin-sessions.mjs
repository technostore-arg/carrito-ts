/** Test: makeAdminSessionToken / verifyAdminSessionToken — roundtrip y rechazo de tokens forjados. */
import assert from 'node:assert/strict'
import { makeAdminSessionToken, verifyAdminSessionToken } from '../server/adminSessions.js'

assert.throws(() => makeAdminSessionToken(''), /ADMIN_SESSION_SECRET/)
const secret = 'secret-compartido-test'
const t = makeAdminSessionToken(secret)
const iat = verifyAdminSessionToken(t, secret)
assert.ok(Number.isFinite(iat) && Math.abs(Date.now() - iat) < 5000, 'token verifica con issuedAt reciente')
assert.equal(verifyAdminSessionToken(t, 'otro'), null)
assert.equal(verifyAdminSessionToken(t + 'x', secret), null)
assert.equal(verifyAdminSessionToken(null, secret), null)
console.log('TEST admin-sessions OK')
