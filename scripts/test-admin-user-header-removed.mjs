/** Test: /api/borradores/:id/aplicar y /descartar ya no leen el header x-admin-user (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.equal(src.includes("req.headers['x-admin-user']"), false, 'Fallo: header x-admin-user sigue siendo leído')
console.log('TEST admin-user-header-removed OK')
