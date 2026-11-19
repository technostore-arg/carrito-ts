/**
 * Test: ruta pública /api/mp/webhook sin verificación ha sido eliminada.
 * Antes del arreglo: la ruta existe y marca pedidos como pagados desde un body no verificado.
 * Después: ya no existe en server/index.js.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
const src = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8')
assert.equal(src.includes("app.post('/api/mp/webhook'"), false, 'Fallo: ruta /api/mp/webhook sigue existiendo (marca pedidos pagados sin verificación)')
console.log('TEST mp-webhook-removed OK - ruta legacy eliminada')
