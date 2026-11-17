/**
 * Tests Fase 3 (MLA): pricing neto, OAuth refresh, idempotencia y workers.
 * Todo en memoria, sin PostgreSQL ni red. Uso: npm run test:ml
 */
import assert from 'node:assert/strict'
import {
  computeMlListingPlan, buildMlItemPayload, syncHubToMercadoLibre, DEFAULT_ML_CONFIG,
} from '../server/ml/mlPricingAndSync.js'
import { createMlClient, buildAuthUrl, TOKEN_REFRESH_MARGIN_MS } from '../server/ml/mlClient.js'
import { recordWebhookEvent, processPendingWebhooks } from '../server/ml/mlWebhooks.js'

const hubConfig = {
  usdArsRate: 1500, listSurchargePercent: 16, safetyStockThreshold: 3,
  categoryMargins: { default: 0.2, notebooks: 0.18 }, vatByCategory: {},
}

const quote = (over = {}) => ({
  sku: 'SKU-ML-1', cost_ars: 500000, vat_rate: 0.105,
  stock: 5, stock_source: 'local', active_supplier: 'LOCAL',
  quarantined: false, quarantine_reasons: [], price_transfer: 900000, ...over,
})

const master = {
  id: 1, sku: 'SKU-ML-1', category: 'notebooks', title: 'Notebook test',
  staticData: { imagenes: ['https://cdn.test/1.jpg'] },
}

/* 1. Margen neto, comisión, envío gratis y precio final */
{
  const plan = computeMlListingPlan({ quote: quote(), master_product: master })
  assert.equal(plan.status, 'active')
  assert.ok(plan.price >= plan.min_price)
  assert.equal(plan.price % 100, 0)
  assert.equal(plan.free_shipping, true) // el precio supera el umbral
  assert.equal(plan.shipping_absorbed, DEFAULT_ML_CONFIG.shippingFixedCost)
  assert.equal(plan.commission_rate, 0.13)
  assert.ok(plan.net_margin >= 0.12)
  assert.equal(plan.manufacturing_days, 0)
  assert.equal(plan.manufacturing_time, null)
  assert.equal(plan.vat_rate, 0.105)
}

/* 2. IVA 21% baja el margen y sube el precio mínimo */
{
  const q21 = quote({ vat_rate: 0.21 })
  const p105 = computeMlListingPlan({ quote: quote(), master_product: master })
  const p21 = computeMlListingPlan({ quote: q21, master_product: master })
  assert.equal(p21.vat_rate, 0.21)
  assert.ok(p21.min_price > p105.min_price)
}

/* 3. Comisión gold_pro (16%) vs gold_special (13%) */
{
  const plan = computeMlListingPlan({
    quote: quote(), master_product: master,
    ml_config: { listingTypeId: 'gold_pro' },
  })
  assert.equal(plan.listing_type_id, 'gold_pro')
  assert.equal(plan.commission_rate, 0.16)
  assert.ok(plan.min_price > computeMlListingPlan({ quote: quote(), master_product: master }).min_price)
}

/* 4. Margen mínimo imposible => skipped_margin */
{
  const plan = computeMlListingPlan({
    quote: quote(), master_product: master,
    ml_config: { minNetMargin: 0.95 },
  })
  assert.equal(plan.status, 'skipped_margin')
  assert.equal(plan.viable, false)
  assert.equal(plan.price, null)
}

/* 5. Manufacturing dinámico: supplier => 2 días */
{
  const plan = computeMlListingPlan({ quote: quote({ stock_source: 'supplier', active_supplier: 'ELIT' }), master_product: master })
  assert.equal(plan.status, 'active')
  assert.equal(plan.manufacturing_days, 2)
  assert.equal(plan.manufacturing_time, '2 days')
}

/* 6. Pausa automática por cuarentena / stock 0 */
{
  const q = computeMlListingPlan({ quote: quote({ quarantined: true, quarantine_reasons: ['COSTO_CERO_O_INVALIDO'] }), master_product: master })
  assert.equal(q.status, 'paused')
  assert.equal(q.stock, 5)
  const s = computeMlListingPlan({ quote: quote({ stock: 0, stock_source: null }), master_product: master })
  assert.equal(s.status, 'paused')
  assert.equal(s.manufacturing_days, 0)
}

/* 7. Payload de item */
{
  const plan = computeMlListingPlan({ quote: quote({ stock_source: 'supplier' }), master_product: master })
  const payload = buildMlItemPayload(master, plan)
  assert.equal(payload.available_quantity, 5)
  assert.equal(payload.manufacturing_time, '2 days')
  assert.equal(payload.pictures[0].source, 'https://cdn.test/1.jpg')
}

/* ---------- Repo en memoria ---------- */
function createMemoryRepo() {
  const state = {
    credential: null, listings: new Map(), orders: new Map(), events: new Map(),
    webhookSeq: 0, logs: [],
    localStock: 5, elitStock: 10,
  }
  const repo = {
    state,
    async getMlConfig() { return { ...DEFAULT_ML_CONFIG } },
    async getMlCredential() { return state.credential },
    async saveMlCredential(c) { state.credential = { ...c, user_id: c.userId, access_token: c.accessToken, refresh_token: c.refreshToken }; return state.credential },
    async getHubBatch({ limit = 50, offset = 0 } = {}) {
      if (offset > 0) return []
      const input = {
        master_product: { ...master },
        supplier_listings: [
          { supplierCode: 'LOCAL', supplierSku: 'LOCAL-1', costAmount: 500000, costCurrency: 'ARS', rawStock: state.localStock },
          { supplierCode: 'ELIT', supplierSku: 'ELIT-1', costAmount: 100, costCurrency: 'USD', rawStock: state.elitStock },
        ],
        pricing_config: hubConfig,
      }
      return [input].slice(0, limit)
    },
    async getMlListing(masterId) { return state.listings.get(masterId) || null },
    async getMlListingByItemId(itemId) {
      for (const l of state.listings.values()) if (l.ml_item_id === itemId) return l
      return null
    },
    async upsertMlListing(l) {
      const key = l.masterProductId
      const prev = state.listings.get(key) || {}
      state.listings.set(key, { ...prev, ...l, master_product_id: key, ml_item_id: l.mlItemId ?? prev.ml_item_id ?? null, listing_type_id: l.listingTypeId || 'gold_special' })
    },
    async insertWebhookEvent(e) {
      if (state.events.has(e.eventKey)) return false
      state.events.set(e.eventKey, { ...e, status: 'pending' })
      return true
    },
    async getPendingWebhookEvents({ limit = 20 } = {}) {
      return [...state.events.values()].filter(e => e.status === 'pending' && !e.processedAt).slice(0, limit)
    },
    async markWebhookEvent(key, status, extra = {}) {
      const ev = state.events.get(key)
      if (ev) Object.assign(ev, { status, ...extra })
    },
    async decrementStock({ quantity }) {
      if (state.localStock >= quantity) { state.localStock -= quantity; return { fulfillmentSource: 'local' } }
      state.elitStock = Math.max(0, state.elitStock - quantity)
      return { fulfillmentSource: 'supplier' }
    },
    async upsertMlOrder(o) { state.orders.set(o.mlOrderId, o) },
    async logSync(s) { state.logs.push(s) },
  }
  return repo
}

function createMockMlClient(over = {}) {
  const calls = { create: [], update: [], pause: [], orders: new Map() }
  return {
    calls,
    async createItem(payload) { calls.create.push(payload); return { id: 'MLA123456789' } },
    async updateItem(id, payload) { calls.update.push({ id, payload }) },
    async pauseItem(id) { calls.pause.push(id) },
    async getOrder(id) { return calls.orders.get(id) || { id, total_amount: 1234, order_items: [] } },
    ...over,
  }
}

/* 8. Worker: crea, es idempotente y pausa ante cuarentena */
{
  const repo = createMemoryRepo()
  const client = createMockMlClient()
  const first = await syncHubToMercadoLibre({ repo, mlClient: client })
  assert.equal(first.created, 1)
  assert.equal(client.calls.create.length, 1)
  const second = await syncHubToMercadoLibre({ repo, mlClient: client })
  assert.equal(second.unchanged, 1)
  assert.equal(client.calls.create.length, 1)

  repo.state.localStock = 0
  repo.state.elitStock = 0
  const third = await syncHubToMercadoLibre({ repo, mlClient: client })
  assert.equal(third.paused, 1)
  assert.equal(client.calls.pause[0], 'MLA123456789')

  const dryRepo = createMemoryRepo()
  const dryClient = createMockMlClient()
  const dry = await syncHubToMercadoLibre({ repo: dryRepo, mlClient: dryClient, dryRun: true })
  assert.equal(dry.created, 1)
  assert.equal(dryClient.calls.create.length, 0)
}

/* 9. OAuth: auto-refresh con 10 min de margen */
{
  const repo = createMemoryRepo()
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ access_token: 'NEW', refresh_token: 'REFRESH2', expires_in: 21600, user_id: 123 }),
      }
    }
    return { ok: true, text: async () => JSON.stringify({ ok: true }) }
  }
  const client = createMlClient({
    repo, fetchImpl, now: () => Date.now(),
    clientId: 'ID', clientSecret: 'SECRET',
  })
  repo.state.credential = {
    userId: 123, accessToken: 'OLD', refreshToken: 'REFRESH1',
    expiresAt: new Date(Date.now() + (TOKEN_REFRESH_MARGIN_MS - 1000)).toISOString(),
  }
  const token = await client.getValidToken()
  assert.equal(token, 'NEW')
  assert.equal(repo.state.credential.access_token, 'NEW')
  assert.equal(calls.filter(u => u.includes('/oauth/token')).length, 1)
  await client.get('/users/me')
  assert.ok(calls.some(u => u.includes('/users/me')))
  assert.match(buildAuthUrl({ clientId: 'ID', redirectUri: 'https://technostore.ar/cb' }), /auth\.mercadolibre\.com\.ar/)
}

/* 10. Webhooks: idempotencia y orden con fulfillment supplier */
{
  const repo = createMemoryRepo()
  const client = createMockMlClient()
  client.calls.orders.set('200000000001', {
    id: 200000000001, total_amount: 900000,
    order_items: [{ item: { id: 'MLA123456789' }, quantity: 2 }],
  })
  const payload = { topic: 'orders_v2', resource: '200000000001', id: 'EV-1' }
  await repo.upsertMlListing({ masterProductId: 1, mlItemId: 'MLA123456789', status: 'active' })
  const a = await recordWebhookEvent({ repo, payload })
  const b = await recordWebhookEvent({ repo, payload })
  assert.equal(a.inserted, true)
  assert.equal(b.inserted, false)

  const res = await processPendingWebhooks({ repo, mlClient: client })
  assert.equal(res.processed, 1)
  assert.equal(repo.state.localStock, 3)
  const order = repo.state.orders.get('200000000001')
  assert.equal(order.fulfillmentSource, 'local')
  assert.equal(order.quantity, 2)

  const res2 = await processPendingWebhooks({ repo, mlClient: client })
  assert.equal(res2.fetched, 0)
  assert.equal(repo.state.localStock, 3) // no se descuenta dos veces
}

/* 11. Webhook de orders con stock local 0 => pending_supplier_order */
{
  const repo = createMemoryRepo()
  const client = createMockMlClient()
  await repo.upsertMlListing({ masterProductId: 1, mlItemId: 'MLA123456789', status: 'active' })
  client.calls.orders.set('200000000002', {
    id: 200000000002, total_amount: 500000,
    order_items: [{ item: { id: 'MLA123456789' }, quantity: 3 }],
  })
  repo.state.localStock = 0
  await recordWebhookEvent({ repo, payload: { topic: 'orders_v2', resource: '200000000002', id: 'EV-2' } })
  await processPendingWebhooks({ repo, mlClient: client })
  const order = repo.state.orders.get('200000000002')
  assert.equal(order.fulfillmentSource, 'supplier')
  assert.equal(order.supplierOrderStatus, 'pending_supplier_order')
  assert.equal(repo.state.elitStock, 7)
}

/* 12. Questions queda pending para el agente y no se reprocesa */
{
  const repo = createMemoryRepo()
  const client = createMockMlClient()
  await recordWebhookEvent({ repo, payload: { topic: 'questions', resource: '987', id: 'EV-3' } })
  const r1 = await processPendingWebhooks({ repo, mlClient: client })
  assert.equal(r1.details[0].status, 'pending_agent')
  assert.equal(repo.state.events.get('EV-3').status, 'pending')
  assert.ok(repo.state.events.get('EV-3').processedAt)
  const r2 = await processPendingWebhooks({ repo, mlClient: client })
  assert.equal(r2.fetched, 0)
}

console.log('ML TESTS OK (12 grupos)')
