/** Test: categorías tal cual Elit + IVA real del producto aplicado al precio de transferencia. */
import assert from 'node:assert/strict'
import { normalizeElitItem } from '../server/hub/elitService.js'
import { computeQuote } from '../server/hub/pricingEngine.js'

const a = normalizeElitItem({ codigo_alfa: 'X', categoria: 'Computadoras', sub_categoria: 'All In One', precio: 100, iva: 10.5, stock_total: 5 })
assert.equal(a.category, 'computadoras')
assert.equal(a.categoryRaw, 'Computadoras')
assert.ok(Math.abs(a.vatRate - 0.105) < 1e-9)

const b = normalizeElitItem({ codigo_alfa: 'Y', categoria: 'Periféricos', sub_categoria: 'Mouse gamer', precio: 50, iva: 21 })
assert.equal(b.category, 'perifericos')
assert.equal(b.categoryRaw, 'Periféricos')

// El IVA real del master gana sobre la regla por categoría (21% para periféricos).
const q = computeQuote({
  master_product: { sku: 'Y', category: 'perifericos', vatRate: 0.105 },
  supplier_listings: [{ supplierCode: 'LOCAL', rawStock: 5, costAmount: 100, costCurrency: 'USD' }],
  pricing_config: { usdArsRate: 1000, listSurchargePercent: 0, categoryMargins: { default: 0 } },
})
assert.equal(q.vat_rate, 0.105)
assert.equal(q.price_transfer, 110500)
console.log('TEST categorias-iva OK')
