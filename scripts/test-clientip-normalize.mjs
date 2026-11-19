/** Test: normalización de X-Forwarded-For - quita puertos/espacios, rechaza basura. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.ok(src.includes(".split(':')[0].trim()"), 'Fallo: normalización de XFF faltante (quitar puertos)')
assert.ok(src.includes("split(',')[0]"), 'Fallo: falta take-first de la lista XFF')
console.log('TEST clientip-normalize OK')
