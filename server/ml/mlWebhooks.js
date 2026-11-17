/**
 * server/ml/mlWebhooks.js — Recepción idempotente y procesador de eventos MLA.
 * El endpoint HTTP solo llama a `recordWebhookEvent` y responde 200 bien rápido.
 */
import { createHash } from 'node:crypto'

/** Normaliza los formatos viejo y nuevo de notificaciones MLA. */
export function normalizeWebhookPayload(payload = {}) {
  const topic = String(payload.topic || payload.type || '').toLowerCase()
  const resource = String(payload.resource || payload.data?.id || payload['x-request-id'] || '')
  const rawKey = payload.id || payload['x-request-id'] || (topic && resource ? `${topic}:${resource}` : '')
  const eventKey = String(rawKey || createHash('sha1').update(JSON.stringify(payload)).digest('hex'))
  return { eventKey, topic, resource }
}

/** Inserta el evento con ON CONFLICT DO NOTHING (repo lo garantiza). */
export async function recordWebhookEvent({ repo, payload, now = () => new Date().toISOString() }) {
  const { eventKey, topic, resource } = normalizeWebhookPayload(payload)
  const inserted = await repo.insertWebhookEvent({
    eventKey,
    topic: topic || 'unknown',
    resource,
    payloadJson: payload,
    createdAt: now(),
  })
  return { inserted, eventKey, topic, resource }
}

/** Procesa eventos pendientes en lotes acotados. */
export async function processPendingWebhooks({
  repo, mlClient, limit = 20, now = () => new Date().toISOString(),
} = {}) {
  const events = await repo.getPendingWebhookEvents({ limit: Math.min(Math.max(1, limit), 100) })
  let processed = 0, ignored = 0, errors = 0
  const details = []

  for (const ev of events) {
    const eventKey = ev.event_key || ev.eventKey
    try {
      if (ev.topic === 'orders_v2') {
        const order = await mlClient.getOrder(ev.resource)
        const items = order?.order_items || order?.items || []
        for (const it of items) {
          const mlItemId = String(it.item?.id || it.item_id || '')
          const qty = Math.max(1, Number(it.quantity) || 1)
          const listing = mlItemId ? await repo.getMlListingByItemId(mlItemId) : null
          if (!listing) continue
          const movement = await repo.decrementStock({
            masterProductId: listing.master_product_id,
            quantity: qty,
          })
          await repo.upsertMlOrder({
            mlOrderId: String(order.id || ev.resource),
            masterProductId: listing.master_product_id,
            quantity: qty,
            totalAmount: Number(order.total_amount) || 0,
            fulfillmentSource: movement.fulfillmentSource || 'local',
            supplierOrderStatus: movement.fulfillmentSource === 'supplier' ? 'pending_supplier_order' : 'none',
            payloadJson: order,
          })
        }
        await repo.markWebhookEvent(eventKey, 'processed', { processedAt: now() })
        processed++
        details.push({ eventKey, status: 'processed' })
      } else if (ev.topic === 'questions') {
        // Queda pending para el Agente de IA (Fase 4), pero se marca como
        // "ya ingerido" con processed_at para que este worker no lo repita.
        await repo.markWebhookEvent(eventKey, 'pending', { processedAt: now(), agentReady: true })
        processed++
        details.push({ eventKey, status: 'pending_agent' })
      } else {
        await repo.markWebhookEvent(eventKey, 'ignored', { processedAt: now() })
        ignored++
        details.push({ eventKey, status: 'ignored' })
      }
    } catch (e) {
      await repo.markWebhookEvent(eventKey, 'error', { processedAt: now(), errorMessage: e.message })
      errors++
      details.push({ eventKey, status: 'error', error: e.message })
    }
  }

  return { job: 'processPendingWebhooks', fetched: events.length, processed, ignored, errors, details }
}
