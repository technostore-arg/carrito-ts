/**
 * Test E2E de integración entre capas (Fase 1-4), sin DB ni red real.
 * Ciclo: Sync Elit -> Catálogo público + /live -> Venta Web -> Venta ML ->
 * stock -> aprobación -> pregunta ML respondida con guardrails.
 * Uso: npm run test:e2e
 */
import assert from 'node:assert/strict'
import { createFixtureClient } from '../server/hub/elitService.js'
import { syncElitCatalog } from '../server/hub/sync.js'
import { buildPublicCatalog } from '../server/hub/publicCatalog.js'
import { computeQuote } from '../server/hub/pricingEngine.js'
import { placeWebOrder } from '../server/hub/orderService.js'
import { processPendingWebhooks } from '../server/ml/mlWebhooks.js'
import { createMlClient } from '../server/ml/mlClient.js'
import { createHubTools } from '../server/agent/hubTools.js'
import { createMockLlm } from '../server/agent/llmClient.js'
import { answerMlQuestions } from '../server/agent/orchestrator.js'
import { processPendingSupplierOrders, verifyApprovalToken } from '../server/agent/orderFulfillmentAgent.js'

function createIntegrationRepo() {
  const s = {
    masters: new Map(), listings: new Map(), hubOrders: new Map(), mlOrders: new Map(),
    approvals: new Map(), events: new Map(), audits: [], seq: 1,
    mlListings: new Map(), notifications: [], answers: [],
  }
  const config = {
    usdArsRate: 1500, listSurchargePercent: 16, safetyStockThreshold: 3,
    categoryMargins: { default: 0.2, notebooks: 0.18, ram: 0.25 },
    vatByCategory: {},
  }
  const inputFor = m => ({
    master_product: {
      id: m.id, sku: m.sku_interno || m.sku, title: m.title, brand: m.brand,
      category: m.category, vatRate: Number(m.vat_rate || m.vatRate || 0.105),
      staticData: m.staticData || m.static_data_json || {},
    },
    supplier_listings: [...s.listings.values()]
      .filter(l => l.master_product_id === m.id || l.masterProductId === m.id)
      .map(l => ({
        supplierCode: l.supplier_code || l.supplierCode,
        supplierSku: l.supplier_sku || l.supplierSku,
        costAmount: Number(l.cost_amount ?? l.costAmount) || 0,
        costCurrency: l.cost_currency || l.costCurrency || 'USD',
        rawStock: Number(l.raw_stock ?? l.rawStock) || 0,
        prevCostAmount: l.prev_cost_amount ?? l.prevCostAmount ?? null,
        quarantineReason: l.quarantine_reason || l.quarantineReason || null,
      })),
    pricing_config: config,
  })
  return {
    s,
    async getConfig() { return config },
    async getPricingConfig() { return config },
    async getMlConfig() { return { autoApproveUsdLimit: 150, approvalSecret: 'e2e-secret', approvalBaseUrl: 'https://test.local' } },
    async findMaster({ ean, mpn, supplierSku }) {
      for (const m of s.masters.values()) {
        if (ean && m.ean === ean) return m
        if (mpn && m.mpn === mpn) return m
        if (m.sku_interno === `ELIT-${supplierSku}`) return m
      }
      return null
    },
    async findMasterBySkuOrEan(key) {
      const k = String(key || '').toUpperCase()
      for (const m of s.masters.values()) {
        if ((m.sku_interno || m.sku) === k || m.ean === k || m.mpn === k) return inputFor(m)
      }
      return null
    },
    async upsertMaster(m) {
      const key = m.sku
      const prev = s.masters.get(key) || {}
      const row = { ...prev, ...m, id: prev.id || s.seq++ }
      s.masters.set(key, row)
      return row
    },
    async upsertListing(masterId, l) {
      const key = `${l.supplierCode}:${l.supplierSku}`
      const prev = s.listings.get(key) || {}
      s.listings.set(key, { ...prev, ...l, master_product_id: typeof masterId === 'object' ? masterId.id : masterId })
    },
    async getHubBatch({ limit = 50 } = {}) {
      return [...s.masters.values()].slice(0, limit).map(inputFor)
    },
    async searchMasterProducts({ limit = 50 } = {}) { return this.getHubBatch({ limit }) },
    async log() {},
    async logSync() {},
    async getMasterProductById(id) {
      for (const m of s.masters.values()) if (m.id === Number(id)) return { ...m, sku: m.sku_interno || m.sku }
      return null
    },
    async getSupplierListing(masterId, code) {
      const l = [...s.listings.values()].find(x => (x.master_product_id === Number(masterId)) && ((x.supplier_code || x.supplierCode) === code))
      return l ? {
        ...l,
        cost_amount: l.cost_amount ?? l.costAmount,
        cost_currency: l.cost_currency ?? l.costCurrency,
        supplier_sku: l.supplier_sku ?? l.supplierSku,
      } : null
    },
    async reserveStock({ masterProductId, quantity, preferredSource }) {
      const code = preferredSource === 'supplier' ? 'ELIT' : 'LOCAL'
      const row = [...s.listings.values()].find(l => l.master_product_id === Number(masterProductId) && (l.supplier_code || l.supplierCode) === code)
      if (!row || (Number(row.raw_stock ?? row.rawStock) || 0) < quantity) throw new Error('Stock insuficiente')
      if ('raw_stock' in row) row.raw_stock -= quantity
      else row.rawStock -= quantity
      return { fulfillmentSource: code === 'ELIT' ? 'supplier' : 'local' }
    },
    async createHubOrder(o) { s.hubOrders.set(o.code, { ...o, id: s.seq++ }) },
    async upsertMlOrder(o) {
      const prev = s.mlOrders.get(o.mlOrderId)
      const row = {
        ...o,
        supplier_order_status: o.supplier_order_status || o.supplierOrderStatus || 'none',
        fulfillment_source: o.fulfillment_source || o.fulfillmentSource || 'local',
        master_product_id: o.master_product_id || o.masterProductId || null,
        id: prev?.id || s.seq++,
      }
      s.mlOrders.set(o.mlOrderId, row)
    },
    async getPendingSupplierOrders() {
      return [...s.mlOrders.values()].filter(o => o.supplier_order_status === 'pending_supplier_order')
    },
    async updateSupplierOrderStatus(id, status) {
      const o = [...s.mlOrders.values()].find(x => x.id === Number(id))
      if (o) o.supplier_order_status = status
    },
    async upsertApproval(a) {
      const prev = [...s.approvals.values()].find(x => (x.external_order_id || x.externalOrderId) === a.externalOrderId)
      const id = prev?.id || s.seq++
      const row = {
        ...(prev || {}), ...a, id,
        external_order_id: a.externalOrderId ?? a.external_order_id,
        approval_token: a.approvalToken ?? a.approval_token ?? prev?.approval_token ?? null,
        total_cost_usd: a.totalCostUsd ?? a.total_cost_usd,
        items_json: a.items ?? a.items_json ?? [],
      }
      s.approvals.set(id, row)
      return row
    },
    async getApprovalById(id) { return s.approvals.get(Number(id)) || null },
    async resolveApproval(id, status) { const a = s.approvals.get(Number(id)); if (a) a.status = status },
    async insertWebhookEvent(e) {
      if (s.events.has(e.eventKey)) return false
      s.events.set(e.eventKey, { ...e, status: 'pending' })
      return true
    },
    async getPendingWebhookEvents() {
      return [...s.events.values()].filter(e => e.status === 'pending' && !e.processedAt)
    },
    async getPendingAgentQuestions() {
      return [...s.events.values()].filter(e => e.agent_state === 'pending_agent')
    },
    async markWebhookEvent(key, status, extra = {}) {
      const ev = s.events.get(key)
      if (!ev) return
      Object.assign(ev, { status, ...extra })
      if (extra.agentState) ev.agent_state = extra.agentState
    },
    async getMlListingByItemId() {
      return s.mlListings.get('MLA1') || { master_product_id: 1, ml_item_id: 'MLA1', status: 'active' }
    },
    async upsertMlListing(l) {
      s.mlListings.set(l.mlItemId || l.ml_item_id, { ...l, master_product_id: l.masterProductId || l.master_product_id })
    },
    async decrementStock({ quantity }) {
      const local = [...s.listings.values()].find(l => (l.supplier_code || l.supplierCode) === 'LOCAL')
      if (local && (Number(local.raw_stock ?? local.rawStock) || 0) >= quantity) {
        if ('raw_stock' in local) local.raw_stock -= quantity
        else local.rawStock -= quantity
        return { fulfillmentSource: 'local' }
      }
      const elit = [...s.listings.values()].find(l => (l.supplier_code || l.supplierCode) === 'ELIT')
      if (elit) {
        if ('raw_stock' in elit) elit.raw_stock = Math.max(0, Number(elit.raw_stock) - quantity)
        else elit.rawStock = Math.max(0, Number(elit.rawStock) - quantity)
      }
      return { fulfillmentSource: 'supplier' }
    },
    async insertAuditLog(a) { s.audits.push(a) },
    async getConversation() { return [] },
    async saveConversation() {},
  }
}

const repo = createIntegrationRepo()

/* 1. Sync Elit (fixture) -> Hub */
const client = createFixtureClient()
const sync = await syncElitCatalog({ client, repo })
assert.equal(sync.processed, 8)
assert.equal(repo.s.masters.size, 8)
assert.equal(sync.quarantined, 1) // EL-1004 costo 0

/* 2. Catálogo público + /live */
const catalog = buildPublicCatalog(await repo.getHubBatch({ limit: 50 }))
// 8 fichas: 1 en cuarentena (costo 0), 2 sin stock publicable (stock 2 y 0).
assert.equal(catalog.length, 5)
const nb = catalog.find(p => p.sku === 'ELIT-EL-1001')
assert.ok(nb && nb.precio_transferencia > 0)
assert.equal(nb.stock_source, 'supplier')
assert.equal(nb.dispatch, undefined) // shape API; el front deriva el badge
const liveInput = await repo.findMasterBySkuOrEan('ELIT-EL-1001')
const live = computeQuote(liveInput)
assert.equal(live.price_transfer, nb.precio_transferencia)
assert.equal(live.stock_source, 'supplier')

/* 3. Venta Web: servidor recalcula precio, envío y reserva stock Elit */
const elitStock = () => { const l = [...repo.s.listings.values()].find(x => (x.supplier_sku || x.supplierSku) === 'EL-1001'); return Number(l.raw_stock ?? l.rawStock) }
const before = Number(elitStock())
const web = await placeWebOrder({
  repo,
  customer: { name: 'Juan Perez', email: 'juan@test.com', cp: '1424', tipoEntrega: 'envio' },
  items: [{ id: 'ELIT-EL-1001', nombre: 'PRECIO FALSO', qty: 1, precio: 1 }],
  couponCode: 'BIENVENIDA10',
})
assert.equal(web.items[0].precio, live.price_transfer)
assert.equal(web.discount, Math.round(web.subtotal * 10) / 100)
assert.equal(web.supplierOrders.length, 1)
assert.equal(repo.s.hubOrders.size, 1)
const after = Number(elitStock())
assert.equal(after, before - 1)
const queued = [...repo.s.mlOrders.values()].find(o => o.supplier_order_status === 'pending_supplier_order')
assert.ok(queued && String(queued.mlOrderId).startsWith('WEB-'))

/* 4. Venta ML -> cola de aprobación por U$S 850 (> 150) */
const notifications = []
const notifier = { async send(m) { notifications.push(m) } }
const elit = { calls: [], async placeOrder(p) { this.calls.push(p); return { order_id: 'EL-E2E' } } }
const purchases = await processPendingSupplierOrders({
  repo, elitClient: elit, notifier,
  config: { approvalSecret: 'e2e-secret', approvalBaseUrl: 'https://test.local', autoApproveUsdLimit: 150 },
})
assert.equal(purchases.pendingApproval, 1)
assert.equal(elit.calls.length, 0)
const approval = [...repo.s.approvals.values()][0]
assert.ok(verifyApprovalToken(approval.approval_token, approval.id, 'e2e-secret'))
assert.ok(notifications[0].approvalUrl.includes('?token='))
assert.ok(!notifications[0].text.includes('?token=' + approval.approval_token + '?action'))

/* 5. Webhook orders_v2 descuenta stock de forma idempotente */
const mlClientMock = {
  calls: { orders: { 'MLA-9': { id: 'MLA-9', total_amount: 500000, order_items: [{ item: { id: 'MLA1' }, quantity: 1 }] } } },
  async getOrder(id) { return this.calls.orders[id] },
  async getQuestion(id) { return { id, item_id: 'MLA1', text: '¿Tienen stock?' } },
  async answerQuestion() {},
}
await repo.upsertMlListing({ masterProductId: 1, mlItemId: 'MLA1', status: 'active' })
const stockBefore = Number(elitStock())
await repo.insertWebhookEvent({ eventKey: 'EVT-ORD-1', topic: 'orders_v2', resource: 'MLA-9', payloadJson: {} })
await repo.insertWebhookEvent({ eventKey: 'EVT-ORD-1', topic: 'orders_v2', resource: 'MLA-9', payloadJson: {} })
await processPendingWebhooks({ repo, mlClient: mlClientMock })
const stockAfter = Number(elitStock())
assert.equal(stockAfter, stockBefore - 1) // sin stock local, descuenta ELIT
const queuedAfter = [...repo.s.mlOrders.values()].find(o => o.mlOrderId === 'MLA-9')
assert.ok(queuedAfter)
const second = await processPendingWebhooks({ repo, mlClient: mlClientMock })
assert.equal(second.fetched, 0)

/* 6. Pregunta ML: ingerida como pending_agent y respondida por el agente */
await repo.insertWebhookEvent({ eventKey: 'EVT-Q-1', topic: 'questions', resource: 'Q-1', payloadJson: {} })
await processPendingWebhooks({ repo, mlClient: mlClientMock })
assert.equal(repo.s.events.get('EVT-Q-1').agent_state, 'pending_agent')
const tools = createHubTools(repo)
const llm = createMockLlm([{ content: 'Hola! Sí, tenés stock disponible. Saludos.', toolCalls: [] }])
const answers = await answerMlQuestions({ repo, mlClient: mlClientMock, tools, llm })
assert.equal(answers.answered, 1)
assert.equal(repo.s.events.get('EVT-Q-1').agent_state, 'answered')
assert.ok(repo.s.audits.some(a => a.channel === 'ml_question' && a.finalResponse))

/* 7. Guardrail: intento de teléfono/URL => escalado, sin respuesta */
await repo.insertWebhookEvent({ eventKey: 'EVT-Q-2', topic: 'questions', resource: 'Q-2', payloadJson: {} })
await processPendingWebhooks({ repo, mlClient: mlClientMock })
const badLlm = createMockLlm([{ content: 'Llamanos al 11-5555-5555 o entrá a technostore.ar', toolCalls: [] }])
const guard = await answerMlQuestions({ repo, mlClient: mlClientMock, tools, llm: badLlm })
assert.equal(guard.escalated, 1)
assert.equal(repo.s.events.get('EVT-Q-2').agent_state, 'escalated')

console.log('E2E FLOW OK (7 etapas)')
