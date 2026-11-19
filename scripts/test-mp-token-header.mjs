/** Test: el token de MP no viaja en la URL del fetch. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/checkout.js', import.meta.url), 'utf8')
assert.equal(src.includes('access_token=${accessToken}'), false, 'Fallo: token de MP en URL (visible en logs/proxies)')
assert.ok(src.includes('Authorization: `Bearer ${accessToken}`'), 'Fallo: header Bearer del token de MP faltante')
console.log('TEST mp-token-header OK')
