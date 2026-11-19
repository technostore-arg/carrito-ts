/** Test: /api/consultas valida campos obligatorios (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.ok(src.includes('Telefono requerido'), 'Fallo: validación de teléfono faltante')
assert.ok(src.includes('Nombre requerido'), 'Fallo: validación de nombre faltante')
assert.ok(src.includes('Mensaje requerido'), 'Fallo: validación de mensaje faltante')
console.log('TEST consultas-validation OK')
