/**
 * Test: signOAuthState/verifyOAuthState no usan el default 'dev-secret'.
 * Antes: signOAuthState('', ...) firma con el default (forjable).
 * Después: lanza.
 */
import assert from 'node:assert/strict'
import { signOAuthState, verifyOAuthState } from '../server/hub/security.js'

assert.throws(() => signOAuthState('', { nonce: 'n1', ts: Date.now() }), /CRON_SECRET/)
const st = signOAuthState('secret-real', { nonce: 'n1', ts: Date.now() })
assert.equal(verifyOAuthState(st, 'secret-real'), true)
assert.equal(verifyOAuthState(st, 'secret-otro'), false)
assert.equal(verifyOAuthState('abc', 'secret-real'), false)
console.log('TEST oauth-state OK')
