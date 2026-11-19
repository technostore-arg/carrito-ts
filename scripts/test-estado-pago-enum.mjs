/** Test: estadoPago en PATCH /api/orders/:id está validado contra la lista de estados (server/index.js). */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.ok(src.includes('Estado de pago inválido'), 'Fallo: validación de estadoPago faltante')
assert.ok(src.includes('!validStatuses.includes(v)'), 'Fallo: uso de validStatuses en estadoPago faltante')
console.log('TEST estado-pago-enum OK')
