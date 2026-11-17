/**
 * Tests Fase 4 (Agente): tool calling, guardrails ML, escalación,
 * compatibilidad y compras a Elit con aprobación. Sin red ni DB.
 * Uso: npm run test:agent
 */
import assert from 'node:assert/strict'
import { createHubTools } from '../server/agent/hubTools.js'
import { createMockLlm } from '../server/agent/llmClient.js'
import { runToolLoop, validateMlResponse, answerMlQuestions, handleSalesChat } from '../server/agent/orchestrator.js'
import { processPendingSupplierOrders, resolveApproval, signApprovalToken } from '../server/agent/orderFulfillmentAgent.js'

const pricingConfig = {
  usdArsRate: 1500, listSurchargePercent: 16, safetyStockThreshold: 3,
  categoryMargins: { default: 0.2, notebooks: 0.18 }, vatByCategory: {},
}
const listingInput = sku => ({
  master_product: {
    id: 1, sku, ean: '7791234567890', title: 'Notebook Lenovo i5 16GB 512GB SSD',
    brand: 'Lenovo', category: 'notebooks', vatRate: 0.105,
    staticData: { descripcion: 'Notebook de prueba', imagenes: ['https://cdn.test/nb.jpg'] },
  },
  supplier_listings: [
    { supplierCode: 'LOCAL', supplierSku: 'LOCAL-1', costAmount: 800000, costCurrency: 'ARS', rawStock: 4 },
    { supplierCode: 'ELIT', supplierSku: 'EL-1001', costAmount: 100, costCurrency: 'USD', rawStock: 8 },
  ],
  pricing_config: pricingConfig,
})

function createMemoryRepo({ costUsd = 100, pendingOrders = [] } = {}) {
  const state = {
    events: [], orders: new Map(), approvals: new Map(), logs: [], conversations: new Map(),
    seq: 1, mlStatus: new Map(),
    listing: { id: 1, master_product_id: 1, ml_item_id: 'MLA1', status: 'active' },
    master: { id: 1, sku_interno: 'SKU-1', title: 'Notebook Lenovo i5 16GB 512GB SSD', category: 'notebooks' },
    supplierListing: { master_product_id: 1, supplier_code: 'ELIT', supplier_sku: 'EL-1001', cost_amount: costUsd, cost_currency: 'USD' },
  }
  return {
    state,
    async searchMasterProducts({ limit = 10 } = {}) { return [listingInput('SKU-1')].slice(0, limit) },
    async findMasterBySkuOrEan() { return listingInput('SKU-1') },
    async getMasterProductById(id) { return state.master },
    async getMlListingByItemId() { return state.listing },
    async getSupplierListing() { return state.supplierListing },
    async getPendingAgentQuestions() { return state.events.filter(e => e.agent_state === 'pending_agent') },
    async markWebhookEvent(key, status, extra = {}) {
      const ev = state.events.find(e => (e.event_key || e.eventKey) === key)
      if (ev) {
        Object.assign(ev, { status, ...extra })
        if (extra.agentState) ev.agent_state = extra.agentState
      }
    },
    async insertAuditLog(entry) { state.logs.push(entry) },
    async getConversation(channel, id) { return state.conversations.get(`${channel}:${id}`) || [] },
    async saveConversation(channel, id, messages) { state.conversations.set(`${channel}:${id}`, messages) },
    async getPendingSupplierOrders() { return pendingOrders },
    async updateSupplierOrderStatus(id, status) { state.mlStatus.set(id, status) },
    async upsertApproval(a) {
      const prev = [...state.approvals.values()].find(x => x.external_order_id === a.externalOrderId)
      const id = prev?.id || state.seq++
      const row = {
        id, order_source: a.orderSource, external_order_id: a.externalOrderId,
        items_json: a.items || [], items: a.items || [], total_cost_usd: a.totalCostUsd,
        status: a.status, approval_token: a.approvalToken ?? prev?.approval_token ?? null,
      }
      state.approvals.set(id, row)
      return row
    },
    async getApprovalById(id) { return state.approvals.get(Number(id)) || null },
    async resolveApproval(id, status) {
      const row = state.approvals.get(Number(id))
      if (row) row.status = status
    },
  }
}

function mockMlClient() {
  const calls = { questions: new Map(), answers: [] }
  return {
    calls,
    async getQuestion(id) {
      return calls.questions.get(id) || { id, item_id: 'MLA1', text: '¿Hola, tiene stock?' }
    },
    async answerQuestion(id, text) { calls.answers.push({ id, text }) },
  }
}

function mockElit() {
  const calls = []
  return { calls, async placeOrder(payload) { calls.push(payload); return { order_id: 'EL-OK', status: 'confirmed' } } }
}

/* 1. Tool calling: el LLM pide searchCatalog y la respuesta usa el precio real */
{
  const repo = createMemoryRepo()
  const tools = createHubTools(repo)
  const llm = createMockLlm([
    { content: '', toolCalls: [{ id: 't1', name: 'searchCatalog', arguments: { query: 'notebook', limit: 1 } }] },
    { content: 'Tenemos disponible', toolCalls: [] },
  ])
  const res = await runToolLoop({ llm, tools, userInput: '¿Tienen notebooks?', context: '' })
  const quote = res.toolsCalled[0].result[0]
  assert.ok(quote.price_transfer > 0)
  assert.equal(quote.stock_source, 'local')
  assert.equal(quote.dispatch, 'Retiro hoy')
  assert.equal(res.content, 'Tenemos disponible')
}

/* 2. Guardrail ML: bloquea teléfono, email y URL */
{
  assert.equal(validateMlResponse('Hola, escribinos al 11 5555-5555').safe, false)
  assert.equal(validateMlResponse('Mail: juan@ejemplo.com').safe, false)
  assert.equal(validateMlResponse('Entrá a technostore.ar').safe, false)
  assert.equal(validateMlResponse('Hola, sí tenemos stock').safe, true)
  assert.ok(validateMlResponse('x'.repeat(600)).text.length <= 454)
}

/* 3. answerMlQuestion: guardrail => escalación sin responder */
{
  const repo = createMemoryRepo()
  const tools = createHubTools(repo)
  const mlClient = mockMlClient()
  repo.state.events.push({ event_key: 'EV-1', resource: 'Q1', topic: 'questions', agent_state: 'pending_agent', payload_json: {} })
  mlClient.calls.questions.set('Q1', { id: 'Q1', item_id: 'MLA1', text: '¿Tienen stock?' })
  const llm = createMockLlm([{ content: 'Llamanos al 11-5555-5555 o mirá technostore.ar', toolCalls: [] }])
  const res = await answerMlQuestions({ repo, mlClient, tools, llm })
  assert.equal(res.escalated, 1)
  assert.equal(res.answered, 0)
  assert.equal(mlClient.calls.answers.length, 0)
  assert.equal(repo.state.events[0].agent_state, 'escalated')
  assert.equal(repo.state.logs[0].escalatedToHuman, true)
}

/* 4. Escalación por certeza técnica insuficiente */
{
  const repo = createMemoryRepo()
  const tools = createHubTools(repo)
  const mlClient = mockMlClient()
  repo.state.events.push({ event_key: 'EV-2', resource: 'Q2', topic: 'questions', agent_state: 'pending_agent', payload_json: {} })
  mlClient.calls.questions.set('Q2', { id: 'Q2', item_id: 'MLA1', text: '¿Es compatible con mi motherboard AM5?' })
  const llm = createMockLlm([{ content: 'Sí, es compatible', toolCalls: [] }])
  const res = await answerMlQuestions({ repo, mlClient, tools, llm })
  assert.equal(res.results[0].reason, 'REQUIERE_CONFIRMACION_TECNICA')
  assert.equal(mlClient.calls.answers.length, 0)
}

/* 5. Respuesta ML válida => se publica y se marca answered */
{
  const repo = createMemoryRepo()
  const tools = createHubTools(repo)
  const mlClient = mockMlClient()
  repo.state.events.push({ event_key: 'EV-3', resource: 'Q3', topic: 'questions', agent_state: 'pending_agent', payload_json: {} })
  mlClient.calls.questions.set('Q3', { id: 'Q3', item_id: 'MLA1', text: '¿Cuánto sale?' })
  const llm = createMockLlm([{ content: 'Hola! El precio es el publicado en la publicación. Saludos.', toolCalls: [] }])
  const res = await answerMlQuestions({ repo, mlClient, tools, llm })
  assert.equal(res.answered, 1)
  assert.equal(mlClient.calls.answers.length, 1)
  assert.equal(repo.state.events[0].agent_state, 'answered')
}

/* 6. Compatibilidad DDR4 vs DDR5 y watts */
{
  const tools = createHubTools(createMemoryRepo())
  const bad = tools.checkHardwareCompatibility({ items: [
    { category: 'motherboard', specs: { socket: 'AM5', ddr: 'DDR5', chipset: 'B650' } },
    { category: 'ram', specs: { ddr: 'DDR4', capacidad: '16GB' } },
    { category: 'procesador', specs: { socket: 'AM5', tdp: '65W' } },
    { category: 'fuentes', specs: { watts: '500W' } },
  ] })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.some(e => e.includes('DDR')))
  const good = tools.checkHardwareCompatibility({ items: [
    { category: 'motherboard', specs: { socket: 'AM5', ddr: 'DDR5' } },
    { category: 'ram', specs: { ddr: 'DDR5' } },
  ] })
  assert.equal(good.errors.length, 0)
}

/* 7. Cart link: permitido en web, bloqueado en ml_question */
{
  const tools = createHubTools(createMemoryRepo())
  const web = tools.buildPreloadedCartUrl({ items: [{ sku: 'SKU-1', qty: 2 }], channel: 'web' })
  assert.equal(web.allowed, true)
  assert.match(web.url, /cart=/)
  const ml = tools.buildPreloadedCartUrl({ items: [{ sku: 'SKU-1' }], channel: 'ml_question' })
  assert.equal(ml.allowed, false)
  const llm = createMockLlm([{ content: '', toolCalls: [{ id: 't2', name: 'buildCartLink', arguments: { items: [{ sku: 'SKU-1' }] } }] }, { content: 'Listo' }])
  const loop = await runToolLoop({ llm, tools, userInput: 'link', channel: 'ml_question' })
  assert.equal(loop.toolsCalled[0].result.reason, 'CANAL_NO_PERMITIDO')
}

/* 8. Chat web guarda conversación y auditoría */
{
  const repo = createMemoryRepo()
  const tools = createHubTools(repo)
  const llm = createMockLlm([{ content: 'Hola, ¿qué buscás?', toolCalls: [] }])
  const res = await handleSalesChat({ repo, tools, llm, userInput: 'Hola', channel: 'web', sessionId: 's1' })
  assert.equal(res.response, 'Hola, ¿qué buscás?')
  assert.equal(repo.state.conversations.get('web:s1').length, 2)
  assert.equal(repo.state.logs.length, 1)
}

/* 9. Compra a Elit: auto < USD 150 */
{
  const repo = createMemoryRepo({ costUsd: 100, pendingOrders: [{ id: 7, ml_order_id: 'MLA7', master_product_id: 1, quantity: 1 }] })
  const elit = mockElit()
  const res = await processPendingSupplierOrders({ repo, elitClient: elit, config: { approvalSecret: 's' } })
  assert.equal(res.autoExecuted, 1)
  assert.equal(elit.calls.length, 1)
  assert.equal(repo.state.mlStatus.get(7), 'ordered')
}

/* 10. Compra >= USD 150: aprobación + token + resolución */
{
  const repo = createMemoryRepo({ costUsd: 200, pendingOrders: [{ id: 8, ml_order_id: 'MLA8', master_product_id: 1, quantity: 1 }] })
  const elit = mockElit()
  const notified = []
  const notifier = { async send(m) { notified.push(m) } }
  const res = await processPendingSupplierOrders({ repo, elitClient: elit, notifier, config: { approvalSecret: 's' } })
  assert.equal(res.pendingApproval, 1)
  assert.equal(elit.calls.length, 0)
  assert.equal(notified.length, 1)
  const approval = [...repo.state.approvals.values()][0]
  assert.equal(approval.status, 'pending_approval')
  assert.equal(approval.approval_token, signApprovalToken(approval.id, 's'))

  const rejected = await resolveApproval({ repo, approvalId: approval.id, token: approval.approval_token, action: 'reject', elitClient: elit, config: { approvalSecret: 's' } })
  assert.equal(rejected.status, 'rejected')
  assert.equal(elit.calls.length, 0)

  const badToken = await resolveApproval({ repo, approvalId: approval.id, token: 'invalido', action: 'approve', elitClient: elit, config: { approvalSecret: 's' } })
  assert.equal(badToken.ok, false)
  assert.equal(badToken.error, 'TOKEN_INVALIDO')

  repo.state.approvals.get(approval.id).status = 'pending_approval'
  const approved = await resolveApproval({ repo, approvalId: approval.id, token: approval.approval_token, action: 'approve', elitClient: elit, config: { approvalSecret: 's' } })
  assert.equal(approved.ok, true)
  assert.equal(approved.status, 'executed')
  assert.equal(elit.calls.length, 1)
}

console.log('AGENT TESTS OK (10 grupos)')
