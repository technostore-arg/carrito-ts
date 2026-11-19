/** Test: /api/products/live tiene rate limiting (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.equal(src.includes("app.post('/api/products/live', rateLimitLive"), true, 'Fallo: /api/products/live sin rate limit')
console.log('TEST products-live-rate-limit OK')
