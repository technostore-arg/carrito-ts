/**
 * Tests de seguridad (AppSec) sin red ni DB. Uso: npm run test:security
 */
import assert from 'node:assert/strict'
import {
  safeCompareSecret, createRateLimiter, rateLimitMiddleware,
  signOAuthState, verifyOAuthState, verifyWhatsappSignature, validateMlWebhookPayload,
} from '../server/hub/security.js'
import { createHmac } from 'node:crypto'
import { signApprovalToken, verifyApprovalToken, processPendingSupplierOrders } from '../server/agent/orderFulfillmentAgent.js'

/* 1. Comparación en tiempo constante */
assert.equal(safeCompareSecret('abc123', 'abc123'), true)
assert.equal(safeCompareSecret('abc123', 'abc124'), false)
assert.equal(safeCompareSecret('abc', 'abcdef'), false)

/* 2. Rate limiting middleware (15/min) */
{
  const limiter = createRateLimiter({ max: 15, windowMs: 60_000 })
  const mw = rateLimitMiddleware(limiter)
  const fakeRes = () => ({ headers: {}, statusCode: 200, body: null,
    setHeader(k, v) { this.headers[k] = v },
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
  })
  let passed = 0
  for (let i = 0; i < 15; i++) {
    const res = fakeRes()
    mw({ ip: '10.0.0.1' }, res, () => { passed++ })
    assert.equal(res.statusCode, 200)
  }
  assert.equal(passed, 15)
  const blocked = fakeRes()
  mw({ ip: '10.0.0.1' }, blocked, () => { passed++ })
  assert.equal(blocked.statusCode, 429)
  assert.equal(passed, 15)
  const other = fakeRes()
  mw({ ip: '10.0.0.2' }, other, () => { passed++ })
  assert.equal(other.statusCode, 200)
  assert.equal(passed, 16)
}

/* 3. Webhook ML de otro seller */
{
  const seller = '123456789'
  assert.equal(validateMlWebhookPayload({ user_id: seller }, seller).valid, true)
  assert.equal(validateMlWebhookPayload({ seller_id: seller }, seller).valid, true)
  const bad = validateMlWebhookPayload({ user_id: '999' }, seller)
  assert.equal(bad.valid, false)
  assert.equal(bad.reason, 'SELLER_MISMATCH')
  assert.equal(validateMlWebhookPayload({}, seller).valid, false)
  assert.equal(validateMlWebhookPayload({ user_id: 'otro' }, '').valid, true) // sin configurar = no bloquea
}

/* 4. OAuth state firmado */
{
  const secret = 'oauth-secret'
  const state = signOAuthState(secret)
  assert.equal(verifyOAuthState(state, secret), true)
  assert.equal(verifyOAuthState(state, 'otro-secret'), false)
  assert.equal(verifyOAuthState('abc.def', secret), false)
  const now = Date.now()
  const expired = signOAuthState(secret, { ts: now - 20 * 60 * 1000 })
  assert.equal(verifyOAuthState(expired, secret, { now }), false)
}

/* 5. Firma HMAC de WhatsApp */
{
  const body = '{"from":"549111234","text":"hola"}'
  const secret = 'wa-secret'
  const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyWhatsappSignature(body, sig, secret), true)
  assert.equal(verifyWhatsappSignature(body, 'sha256=bad', secret), false)
  assert.equal(verifyWhatsappSignature(body, '', ''), true) // sin secret no bloquea
}

/* 6. Expiración de tokens de aprobación (24 hs) */
{
  const id = 7
  const secret = 'approval-secret'
  assert.equal(verifyApprovalToken(signApprovalToken(id, secret, Date.now() + 60_000), id, secret), true)
  assert.equal(verifyApprovalToken(signApprovalToken(id, secret, Date.now() - 1000), id, secret), false)
  assert.equal(verifyApprovalToken(signApprovalToken(id, secret, Date.now() + 60_000), 'otro', secret), false)
  assert.equal(verifyApprovalToken(signApprovalToken(id, secret), id, secret), true) // legado
}

/* 7. Tope diario acumulado: U$S 100 auto-aprobable, pero ya se gastaron 380 */
{
  const approvals = []
  const notifications = []
  const repo = {
    async getAutoSpendLast24h() { return 380 },
    async getPendingSupplierOrders() {
      return [{ id: 1, ml_order_id: 'MLA-77', master_product_id: 1, quantity: 1 }]
    },
    async getMasterProductById() { return { id: 1, sku: 'SKU-1' } },
    async getSupplierListing() {
      return { master_product_id: 1, supplier_sku: 'EL-1', cost_amount: 100, cost_currency: 'USD' }
    },
    async upsertApproval(a) {
      const prev = approvals.find(x => x.externalOrderId === a.externalOrderId)
      if (prev) Object.assign(prev, a)
      else approvals.push({ ...a, id: approvals.length + 1 })
      return approvals[approvals.length - 1]
    },
    async updateSupplierOrderStatus() {},
  }
  const elit = { calls: [], async placeOrder(p) { this.calls.push(p); return { order_id: 'OK' } } }
  const notifier = { async send(m) { notifications.push(m) } }
  const res = await processPendingSupplierOrders({
    repo, elitClient: elit, notifier,
    config: { approvalSecret: 's', autoApproveUsdLimit: 150, dailyAutoSpendCapUsd: 400, approvalBaseUrl: 'https://test.local' },
  })
  assert.equal(res.pendingApproval, 1)
  assert.equal(elit.calls.length, 0)
  assert.equal(notifications.length, 1)
  assert.equal(approvals[0].status, 'pending_approval')
  assert.ok(verifyApprovalToken(approvals[0].approvalToken, approvals[0].id, 's'))
}

console.log('SECURITY TESTS OK (7 grupos)')
