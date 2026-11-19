/** Test: headers de seguridad HSTS + CSP presentes en index.js y vercel.json. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.ok(src.includes('Strict-Transport-Security'), 'Fallo: HSTS faltante en server/index.js')
assert.ok(src.includes('Content-Security-Policy'), 'Fallo: CSP faltante en server/index.js')
const vj = fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
assert.ok(vj.includes('Strict-Transport-Security'), 'Fallo: HSTS faltante en vercel.json')
assert.ok(vj.includes('Content-Security-Policy'), 'Fallo: CSP faltante en vercel.json')
console.log('TEST security-headers OK')
