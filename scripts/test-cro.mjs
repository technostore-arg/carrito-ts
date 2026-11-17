/** Tests rápidos de la lógica CRO (sin DOM). Uso: node scripts/test-cro.mjs */
import assert from 'node:assert/strict'
import { priceInfo, installmentsLabel, priceForMethod } from '../apps/technostore/src/utils/pricing.js'
import { validarEmail, validarTelefono, validarCp, validarDocumento, validarCheckout } from '../apps/technostore/src/utils/validation.js'
import { stockState } from '../apps/technostore/src/utils/stock.js'
import { modernSrc } from '../apps/technostore/src/utils/images.js'
import { shippingCost, shippingZone, FREE_SHIPPING_THRESHOLD, COUPONS } from '../apps/technostore/src/config/store.js'

const p = { precio_transferencia: 100000, precio_mercadopago: 116000 }
assert.deepEqual(priceInfo(p), { lista: 116000, transferencia: 100000, ahorro: 16000, porcentaje: 14 })
assert.match(installmentsLabel({ ...p, precio_lista: 120000 }), /3 cuotas sin interés de \$ 40.000/)
assert.equal(priceForMethod(p, 'transferencia'), 100000)
assert.equal(priceForMethod(p, 'tarjeta'), 116000)

assert.equal(validarEmail('juan@email.com'), null)
assert.ok(validarEmail('juan@email'))
assert.equal(validarTelefono('+54 9 11 5555-5555'), null)
assert.equal(validarTelefono('5491127650658'), null)
assert.ok(validarTelefono('123'))
assert.equal(validarCp('1424'), null)
assert.ok(validarCp('142'))
assert.equal(validarDocumento('DNI', '30.123.456'), null)
assert.ok(validarDocumento('DNI', '123'))
assert.equal(validarDocumento('CUIT', '20301234565'), null)
assert.ok(validarDocumento('CUIT', '20301234566'))
assert.ok(validarCheckout({ nombre: 'Juan Perez', email: 'a@b.com', telefono: '1112345678', cp: '1424', direccion: 'Av. Santa Fe 2844', tipoEntrega: 'envio', tipoDocumento: 'DNI', documento: '30123456' }).nombre === null)

assert.equal(stockState({ stock: 5, stock_source: 'local' }), 'local')
assert.equal(stockState({ stock: 5, stock_source: 'supplier' }), 'supplier')
assert.equal(stockState({ stock: 0 }), 'agotado')
assert.equal(stockState({ stock: 0, tipo_venta: 'encargo' }), 'encargo')

assert.equal(shippingCost('1424', 0), 0)
assert.equal(shippingCost('1424', 50000), 15000)
assert.equal(shippingCost('1424', FREE_SHIPPING_THRESHOLD), 0)
assert.equal(shippingZone('9999').label, 'Patagonia / Sur')
assert.ok(COUPONS.BIENVENIDA10.valor === 10)
assert.equal(modernSrc('https://images.unsplash.com/photo-1.jpg', 'webp').includes('fm=webp'), true)
assert.equal(modernSrc('https://insumosacuario.com.ar/img.jpg', 'webp'), '')

console.log('CRO TESTS OK (12 grupos)')
