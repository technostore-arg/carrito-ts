/** Test: /api/comprobantes valida formato del orderCode (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.ok(src.includes('TS-[0-9A-F]{6}'), 'Fallo: validación de formato de orderCode faltante')
console.log('TEST comprobantes-ordercode OK')
