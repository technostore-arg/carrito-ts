/**
 * server/agent/orderFulfillmentAgent.js — Compras a Elit con Human-in-the-Loop.
 * Repositorio, elitClient y notifier inyectables (tests 100% locales).
 */
import { createHmac } from 'node:crypto'
import { safeCompareSecret } from '../hub/security.js'

export const DEFAULT_AUTO_APPROVE_USD_LIMIT = 150
export const DEFAULT_DAILY_SPEND_CAP_USD = 400
export const APPROVAL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Token HMAC con expiración opcional (24 hs en el flujo de aprobación).
 * El formato sin expiración se mantiene por compatibilidad con tokens viejos.
 */
export function signApprovalToken(id, secret, expiresAtMs = null) {
  const key = secret || 'dev-secret'
  if (!expiresAtMs) return createHmac('sha256', key).update(String(id)).digest('base64url')
  const payload = Buffer.from(`${id}:${expiresAtMs}`).toString('base64url')
  const sig = createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/** @param {string} token @param {string|number} id @param {string} secret */
export function verifyApprovalToken(token, id, secret, { now = () => Date.now() } = {}) {
  const raw = String(token || '')
  const key = secret || 'dev-secret'
  if (!raw.includes('.')) {
    return safeCompareSecret(raw, createHmac('sha256', key).update(String(id)).digest('base64url'))
  }
  const [payload, sig] = raw.split('.')
  if (!payload || !safeCompareSecret(sig, createHmac('sha256', key).update(payload).digest('base64url'))) return false
  try {
    const [tokenId, exp] = Buffer.from(payload, 'base64url').toString('utf8').split(':')
    const expires = Number(exp)
    return String(tokenId) === String(id) && Number.isFinite(expires) && now() < expires
  } catch {
    return false
  }
}

/** Notificador de Telegram (inyectable; sin credenciales sólo loguea). */
export function createTelegramNotifier({ botToken, chatId, fetchImpl = fetch } = {}) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN || ''
  const chat = chatId || process.env.TELEGRAM_CHAT_ID || ''
  return {
    async send({ text, approvalUrl } = {}) {
      const sep = approvalUrl.includes('?') ? '&' : '?'
      const message = `${text}${approvalUrl ? `\n\nAprobar: ${approvalUrl}${sep}action=approve\nRechazar: ${approvalUrl}${sep}action=reject` : ''}`
      if (!token || !chat) { console.log('[telegram:mock]', message); return { sent: false } }
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: message, parse_mode: 'HTML' }),
      })
      return { sent: res.ok }
    },
  }
}

/**
 * Procesa órdenes con supplier_order_status = pending_supplier_order.
 * @param {{repo:object, elitClient:object, notifier?:object, config?:object, limit?:number}} deps
 */
export async function processPendingSupplierOrders({
  repo, elitClient, notifier, config = {}, limit = 20,
} = {}) {
  const autoLimit = Number(config.autoApproveUsdLimit ?? process.env.AUTO_APPROVE_USD_LIMIT) || DEFAULT_AUTO_APPROVE_USD_LIMIT
  const dailyCap = Number(config.dailyAutoSpendCapUsd ?? process.env.DAILY_AUTO_SPEND_CAP_USD) || DEFAULT_DAILY_SPEND_CAP_USD
  let spentLast24h = Number(await repo.getAutoSpendLast24h?.()) || 0
  const usdRate = Number(config.usdArsRate) || 1550
  const approvalSecret = config.approvalSecret || process.env.APPROVAL_SECRET || 'dev-secret'
  const baseUrl = (config.approvalBaseUrl || process.env.APPROVAL_BASE_URL || 'https://carrito-ts-neon.vercel.app').replace(/\/$/, '')
  const notify = notifier || createTelegramNotifier()
  const orders = await repo.getPendingSupplierOrders({ limit })
  const results = []

  for (const order of orders) {
    try {
      const master = await repo.getMasterProductById(order.master_product_id)
      const listing = await repo.getSupplierListing(order.master_product_id, 'ELIT')
      if (!master || !listing) throw new Error('No se encontró el SKU de Elit para la orden')
      const qty = Math.max(1, Number(order.quantity) || 1)
      const unitUsd = String(listing.cost_currency || 'USD').toUpperCase() === 'ARS'
        ? (Number(listing.cost_amount) || 0) / usdRate
        : (Number(listing.cost_amount) || 0)
      const totalCostUsd = Math.round(unitUsd * qty * 100) / 100
      const items = [{ sku: listing.supplier_sku || listing.supplierSku, qty, cost_usd: unitUsd }]

      if (totalCostUsd < autoLimit && (spentLast24h + totalCostUsd) < dailyCap) {
        const placed = await elitClient.placeOrder({ items })
        await repo.upsertApproval({
          orderSource: 'ml', externalOrderId: String(order.id), items,
          totalCostUsd, status: 'auto_executed', approvalToken: null,
        })
        spentLast24h += totalCostUsd
        await repo.updateSupplierOrderStatus(order.id, 'ordered')
        results.push({ orderId: order.id, status: 'auto_executed', totalCostUsd, placed })
        continue
      }

      const created = await repo.upsertApproval({
        orderSource: 'ml', externalOrderId: String(order.id), items,
        totalCostUsd, status: 'pending_approval', approvalToken: null,
      })
      const approvalId = created?.id
      const token = signApprovalToken(approvalId, approvalSecret, Date.now() + APPROVAL_TOKEN_TTL_MS)
      await repo.upsertApproval({
        orderSource: 'ml', externalOrderId: String(order.id), items,
        totalCostUsd, status: 'pending_approval', approvalToken: token,
      })
      const approvalUrl = `${baseUrl}/api/agent/approvals/${approvalId}/resolve?token=${encodeURIComponent(token)}`
      await notify.send({
        text: `🛒 Compra a Elit pendiente de aprobación • Orden ${order.ml_order_id || order.id} • Total U$S ${totalCostUsd}`,
        approvalUrl,
      })
      results.push({ orderId: order.id, approvalId, status: 'pending_approval', totalCostUsd })
    } catch (e) {
      results.push({ orderId: order.id, status: 'error', error: e.message })
    }
  }

  return {
    job: 'processPendingSupplierOrders', fetched: orders.length,
    autoExecuted: results.filter(r => r.status === 'auto_executed').length,
    pendingApproval: results.filter(r => r.status === 'pending_approval').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  }
}

/** Resuelve una aprobación por token firmado (aprobar / rechazar). */
export async function resolveApproval({ repo, approvalId, token, action, elitClient, config = {} } = {}) {
  const secret = config.approvalSecret || process.env.APPROVAL_SECRET || 'dev-secret'
  if (!verifyApprovalToken(token, approvalId, secret)) return { ok: false, error: 'TOKEN_INVALIDO' }
  const approval = await repo.getApprovalById(approvalId)
  if (!approval) return { ok: false, error: 'APROBACION_NO_ENCONTRADA' }
  if (!['pending_approval', 'approved'].includes(approval.status)) {
    return { ok: false, error: 'YA_RESUELTA', status: approval.status }
  }

  if (action === 'reject') {
    await repo.resolveApproval(approvalId, 'rejected', approval.external_order_id)
    return { ok: true, status: 'rejected' }
  }
  if (action !== 'approve') return { ok: false, error: 'ACCION_INVALIDA' }

  try {
    const items = typeof approval.items_json === 'string' ? JSON.parse(approval.items_json) : (approval.items_json || [])
    const placed = await elitClient.placeOrder({ items })
    await repo.resolveApproval(approvalId, 'executed', approval.external_order_id)
    return { ok: true, status: 'executed', placed }
  } catch (e) {
    await repo.resolveApproval(approvalId, 'failed', approval.external_order_id)
    return { ok: false, error: e.message, status: 'failed' }
  }
}
