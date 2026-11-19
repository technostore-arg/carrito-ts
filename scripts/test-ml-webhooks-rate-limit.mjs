/** Test: /api/ml/webhooks tiene rate limiting (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.equal(src.includes("app.post('/api/ml/webhooks', rateLimitWebhooks"), true, 'Fallo: /api/ml/webhooks sin rate limit')
console.log('TEST ml-webhooks-rate-limit OK')
