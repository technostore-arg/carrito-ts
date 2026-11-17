/**
 * Tests unitarios/integración del hub Fase 2 (sin PostgreSQL real).
 * Uso: node scripts/test-pricing-sync.mjs
 */
import assert from 'node:assert/strict'
import {
  computeQuote, toLegacyQuote, vatRateFor, toArs, quarantineReason,
  pickActiveListing, VAT_CORE, VAT_GENERAL,
} from '../server/hub/pricingEngine.js'
import { createElitClient, normalizeElitItem } from '../server/hub/elitService.js'
import { syncElitCatalog, syncElitStockAndPrices } from '../server/hub/sync.js'

const config = {
  usdArsRate: 1500,
  listSurchargePercent: 16,
  safetyStockThreshold: 3,
  categoryMargins: { default: 0.2, notebooks: 0.18, ram: 0.25, accesorios: 0.35 },
  vatByCategory: {},
}

/** Repo en memoria con la misma interfaz que createPgRepository. */
function createMemoryRepo() {
  const masters = new Map()
  const listings = new Map()
  const logs = []
  let seq = 1
  return {
    logs, masters, listings,
    async getConfig() { return config },
    async findMaster({ ean, mpn, supplierSku }) {
      for (const m of masters.values()) {
        if (ean && m.ean === ean) return m
        if (mpn && m.mpn === mpn) return m
        if (m.sku === `ELIT-${supplierSku}`) return m
      }
      return null
    },
    async upsertMaster(m) {
      const key = m.sku
      const prev = masters.get(key)
      const master = { ...(prev || {}), ...m, id: prev?.id || seq++ }
      masters.set(key, master)
      return master
    },
    async findListing(code, sku) {
      return listings.get(`${code}:${sku}`) || null
    },
    async upsertListing(masterRef, l) {
      const key = `${l.supplierCode}:${l.supplierSku}`
      const prev = listings.get(key) || {}
      const masterId = typeof masterRef === 'object' ? masterRef.id : masterRef
      listings.set(key, { ...prev, ...l, id: prev.id || seq++, masterId })
    },
    async log(s) { logs.push(s) },
  }
}

const master = (category, sku = 'SKU-1') => ({
  sku, category, title: 'Producto test', vatRate: 0,
})
const listing = (code, cost, currency, stock, extra = {}) => ({
  supplierCode: code, costAmount: cost, costCurrency: currency, rawStock: stock,
  lastSyncedAt: null, ...extra,
})

/* 1. IVA discriminado */
assert.equal(vatRateFor('notebooks', config), VAT_CORE)
assert.equal(vatRateFor('ssd-nvme', config), VAT_CORE)
assert.equal(vatRateFor('accesorios', config), VAT_GENERAL)
assert.equal(vatRateFor('monitores', config), VAT_GENERAL)

/* 2. Conversión USD → ARS */
assert.equal(toArs(100, 'USD', 1500), 150000)
assert.equal(toArs(100000, 'ARS', 1500), 100000)
assert.equal(toArs(0, 'USD', 1500), null)
assert.equal(toArs(100, 'EUR', 1500), null)

/* 3. Cálculo transfer/list con IVA 10.5% y margen */
{
  const q = computeQuote({
    master_product: master('notebooks'),
    supplier_listings: [listing('LOCAL', 1000000, 'ARS', 2)],
    pricing_config: config,
  })
  // 1.000.000 * 1,105 * 1,18 = 1.303.900 ; list +16% = 1.512.524
  assert.equal(q.price_transfer, 1303900)
  assert.equal(q.price_list, 1512524)
  assert.equal(q.stock, 2)
  assert.equal(q.stock_source, 'local')
  assert.equal(q.active_supplier, 'LOCAL')
  assert.equal(toLegacyQuote(q).precio_transferencia, 1303900)
}

/* 4. Conmutación automática local -> supplier (+ stock mínimo) */
{
  const q = computeQuote({
    master_product: master('ram'),
    supplier_listings: [
      listing('LOCAL', 90000, 'ARS', 0),
      listing('ELIT', 100, 'USD', 5),
    ],
    pricing_config: config,
  })
  // 100 USD * 1500 = 150.000 ARS * 1,105 * 1,25 = 207.187,5 → 207.188
  assert.equal(q.price_transfer, 207188)
  assert.equal(q.stock, 5)
  assert.equal(q.stock_source, 'supplier')
  assert.equal(q.active_supplier, 'ELIT')
}

/* 5. Stock mayorista por debajo del umbral => sin stock */
{
  const q = computeQuote({
    master_product: master('ram'),
    supplier_listings: [listing('LOCAL', 90000, 'ARS', 0), listing('ELIT', 100, 'USD', 2)],
    pricing_config: config,
  })
  assert.equal(q.stock, 0)
  assert.equal(q.stock_source, null)
  assert.equal(q.price_transfer, null)
}

/* 6. Costo 0 => cuarentena */
{
  const q = computeQuote({
    master_product: master('accesorios'),
    supplier_listings: [listing('LOCAL', 0, 'ARS', 4)],
    pricing_config: config,
  })
  assert.equal(q.quarantined, true)
  assert.deepEqual(q.quarantine_reasons, ['local:COSTO_CERO_O_INVALIDO'])
  assert.equal(q.price_transfer, null)
}

/* 7. Caída de precio >= 40% => cuarentena (y fallback a otro proveedor) */
{
  const reason = quarantineReason(listing('ELIT', 500, 'USD', 5, { prevCostAmount: 1000 }))
  assert.match(reason, /^CAIDA_PRECIO_50%$/)
  const q = computeQuote({
    master_product: master('gpus'),
    supplier_listings: [
      listing('ELIT', 500, 'USD', 5, { prevCostAmount: 1000 }),
      listing('LOCAL', 200000, 'ARS', 3),
    ],
    pricing_config: config,
  })
  assert.equal(q.quarantined, false)
  assert.equal(q.stock_source, 'local')
  assert.equal(q.active_supplier, 'LOCAL')
}

/* 8. Prioridad: local con stock gana aunque Elit tenga más */
{
  const picked = pickActiveListing([listing('LOCAL', 10, 'ARS', 1), listing('ELIT', 10, 'USD', 99)], config)
  assert.equal(picked.source, 'local')
  assert.equal(picked.activeSupplier, 'LOCAL')
}

/* 9. Cliente fixture de Elit */
const client = createElitClient({ useFixture: true })
assert.equal(client.mode, 'fixture')
const catalog = await client.getCatalog()
assert.equal(catalog.length, 8)
assert.equal(normalizeElitItem({ codigo: 'X', precio_usd: 10, stock: 2 }).costCurrency, 'USD')
assert.equal(normalizeElitItem({ codigo: 'X', precio: 10, moneda: 'ARS' }).costCurrency, 'ARS')

/* 10. Workers con repo en memoria */
const repo = createMemoryRepo()
const catalogResult = await syncElitCatalog({ client, repo })
assert.equal(catalogResult.processed, 8)
assert.equal(repo.masters.size, 8)
assert.equal(catalogResult.quarantined, 1) // EL-1004 costo 0
const mNotebook = await repo.findMaster({ supplierSku: 'EL-1001' })
assert.equal(mNotebook.vatRate, VAT_CORE)
const mAccesorio = await repo.findMaster({ supplierSku: 'EL-1003' })
assert.equal(mAccesorio.vatRate, VAT_GENERAL)

// Simulamos un costo anterior alto para probar el guard de caída.
await repo.upsertListing(mNotebook.id, { supplierCode: 'ELIT', supplierSku: 'EL-1001', costAmount: 1500, costCurrency: 'USD', rawStock: 7 })
const stockResult = await syncElitStockAndPrices({ client, repo })
assert.equal(stockResult.processed, 8)
assert.ok(stockResult.quarantined >= 2) // costo 0 + caída >40%
assert.equal(repo.logs.length, 2)
const qElit = computeQuote({
  master_product: master('ram', 'ELIT-EL-1005'),
  supplier_listings: [await repo.findListing('ELIT', 'EL-1005')],
  pricing_config: config,
})
assert.equal(qElit.stock, 4)
assert.equal(qElit.active_supplier, 'ELIT')

console.log('PRICING/SYNC TESTS OK (10 grupos)')
