/** Test: pasarelas, promos vigentes y precio lista para medios con tarjeta (transferencia siempre con impuestos). */
import assert from 'node:assert/strict'
import { PAYMENT_METHODS, promosVigentes } from '../apps/technostore/src/config/payments.js'
import { placeWebOrder } from '../server/hub/orderService.js'

for (const id of ['mercadopago', 'mercadocredito', 'openpay', 'sipago']) {
  assert.ok(PAYMENT_METHODS.some(m => m.id === id), `Falta el medio de pago ${id}`)
}

const hoy = promosVigentes(new Date('2026-11-19'))
assert.ok(hoy.some(p => p.id === 'mp-credito'), 'Falta promo de Mercado Crédito')
assert.ok(hoy.some(p => p.id === 'openpay-bbva-reintegro'), 'Falta promo BBVA')
assert.ok(hoy.some(p => p.bank === 'credicoop'), 'Falta promo Cabal Credicoop')
assert.equal(hoy.some(p => p.id === 'sipago-green-friday'), false, 'Green Friday no está vigente el 19/11')
assert.ok(promosVigentes(new Date('2026-11-27')).some(p => p.id === 'sipago-green-friday'), 'Green Friday vigente el 27/11')

const repo = {
  findMasterBySkuOrEan: async () => ({
    master_product: { id: 1, sku: 'X', category: 'accesorios', vatRate: 0.21 },
    supplier_listings: [{ supplierCode: 'LOCAL', rawStock: 10, costAmount: 100, costCurrency: 'USD' }],
    pricing_config: { usdArsRate: 1000, listSurchargePercent: 16, categoryMargins: { default: 0 } },
  }),
  createHubOrder: async () => {},
  reserveStock: async () => ({ fulfillmentSource: 'local' }),
  upsertMlOrder: async () => {},
}
const customer = { name: 'Test User', email: 'test@example.com' }
const conTarjeta = await placeWebOrder({ repo, customer, items: [{ id: 'X', qty: 1 }], paymentMethod: 'mercadopago' })
const conTransferencia = await placeWebOrder({ repo, customer, items: [{ id: 'X', qty: 1 }], paymentMethod: 'transferencia' })
assert.equal(conTarjeta.items[0].precio, 140360)
assert.equal(conTransferencia.items[0].precio, 121000)
console.log('TEST payments-config OK')
