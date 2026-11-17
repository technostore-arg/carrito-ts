/** Repositorio PostgreSQL del agente (hereda el repo MLA de la Fase 3). */
import { getPricingConfig } from '../hub/repository.js'
import { createMlRepository } from '../ml/mlRepository.js'

/** Convierte una fila de master a la forma que consume computeQuote. */
function toInput(row, listings) {
  return {
    master_product: {
      id: row.id, sku: row.sku_interno, ean: row.ean, mpn: row.mpn,
      title: row.title, brand: row.brand, category: row.category,
      vatRate: Number(row.vat_rate), staticData: row.static_data_json || {},
    },
    supplier_listings: (listings || []).map(l => ({
      supplierCode: l.supplier_code,
      supplierSku: l.supplier_sku,
      costAmount: l.cost_amount == null ? null : Number(l.cost_amount),
      costCurrency: l.cost_currency,
      rawStock: Number(l.raw_stock) || 0,
      prevCostAmount: l.prev_cost_amount == null ? null : Number(l.prev_cost_amount),
      quarantineReason: l.quarantine_reason,
    })),
  }
}

export function createAgentRepository(pool) {
  const ml = createMlRepository(pool)

  async function fetchInputs(where, params, limit = 20) {
    const config = await getPricingConfig(pool)
    const { rows } = await pool.query(
      `SELECT id, ean, mpn, sku_interno, title, brand, category, vat_rate, static_data_json
         FROM master_products WHERE is_active = TRUE AND ${where} ORDER BY id LIMIT $1`,
      [limit, ...params]
    )
    if (!rows.length) return []
    const { rows: listings } = await pool.query(
      `SELECT * FROM supplier_listings WHERE master_product_id = ANY($1)`,
      [rows.map(r => r.id)]
    )
    return rows.map(r => ({
      ...toInput(r, listings.filter(l => l.master_product_id === r.id)),
      pricing_config: config,
    }))
  }

  return {
    ...ml,

    async searchMasterProducts({ query = '', category = '', limit = 20 } = {}) {
      const q = `%${String(query).toLowerCase()}%`
      const params = [q, q, q, q, q]
      const where = `(lower(title) LIKE $2 OR lower(brand) LIKE $3 OR lower(sku_interno) LIKE $4
                      OR lower(COALESCE(ean,'')) LIKE $5 OR lower(COALESCE(mpn,'')) LIKE $6)`
      const cat = String(category || '').toLowerCase()
      const sql = cat ? `${where} AND lower(category) = $${params.length + 2}` : where
      return fetchInputs(sql, cat ? [...params, cat] : params, Math.min(Math.max(limit, 1), 50))
    },

    async findMasterBySkuOrEan(skuOrEan) {
      const key = String(skuOrEan || '').toUpperCase()
      const inputs = await fetchInputs(
        `(upper(sku_interno) = $2 OR upper(COALESCE(ean,'')) = $2 OR upper(COALESCE(mpn,'')) = $2)`,
        [key], 1
      )
      return inputs[0] || null
    },

    async getMasterProductById(id) {
      const { rows } = await pool.query('SELECT * FROM master_products WHERE id = $1', [id])
      return rows[0] ? { ...rows[0], sku: rows[0].sku_interno } : null
    },

    async getSupplierListing(masterProductId, supplierCode) {
      const { rows } = await pool.query(
        'SELECT * FROM supplier_listings WHERE master_product_id = $1 AND supplier_code = $2',
        [masterProductId, supplierCode]
      )
      return rows[0] || null
    },

    /** Reserva stock en el origen solicitado (o el alternativo si no alcanza). */
    async reserveStock({ masterProductId, quantity, preferredSource = 'local' }) {
      const qty = Math.max(1, Number(quantity) || 1)
      const order = preferredSource === 'supplier' ? ['ELIT', 'LOCAL'] : ['LOCAL', 'ELIT']
      for (const code of order) {
        const { rows } = await pool.query(
          'SELECT raw_stock FROM supplier_listings WHERE master_product_id = $1 AND supplier_code = $2',
          [masterProductId, code]
        )
        if (!rows[0] || Number(rows[0].raw_stock) < qty) continue
        await pool.query(
          'UPDATE supplier_listings SET raw_stock = raw_stock - $2, updated_at = now() WHERE master_product_id = $1 AND supplier_code = $3',
          [masterProductId, qty, code]
        )
        return { fulfillmentSource: code === 'ELIT' ? 'supplier' : 'local' }
      }
      throw new Error('Stock insuficiente en todos los proveedores')
    },

    async getAutoSpendLast24h() {
      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(total_cost_usd),0) AS spent
           FROM supplier_purchase_approvals
          WHERE status IN ('auto_executed','executed')
            AND created_at >= now() - interval '24 hours'`
      )
      return Number(rows[0]?.spent) || 0
    },

    async createHubOrder(o) {
      await pool.query(
        `INSERT INTO hub_orders (code, channel, customer_json, items_json, subtotal, discount,
                                 shipping, total, payment_method)
         VALUES ($1,'web',$2::jsonb,$3::jsonb,$4,$5,$6,$7,$8)`,
        [o.code, JSON.stringify(o.customer || {}), JSON.stringify(o.items || []),
         o.subtotal || 0, o.discount || 0, o.shipping || 0, o.total || 0, o.paymentMethod || null]
      )
    },

    async getConversation(channel, externalSessionId) {
      const { rows } = await pool.query(
        'SELECT messages_json FROM agent_conversations WHERE channel = $1 AND external_session_id = $2',
        [channel, externalSessionId]
      )
      return rows[0]?.messages_json || []
    },

    async saveConversation(channel, externalSessionId, messages) {
      await pool.query(
        `INSERT INTO agent_conversations (channel, external_session_id, messages_json)
         VALUES ($1,$2,$3::jsonb)
         ON CONFLICT (channel, external_session_id) DO UPDATE SET messages_json = EXCLUDED.messages_json,
             updated_at = now()`,
        [channel, externalSessionId, JSON.stringify(messages.slice(-40))]
      )
    },

    async insertAuditLog(entry) {
      await pool.query(
        `INSERT INTO agent_audit_logs (channel, reference_id, user_input, tools_called_json,
                                       final_response, confidence_score, escalated_to_human)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
        [entry.channel, entry.referenceId || null, entry.userInput || null,
         JSON.stringify(entry.toolsCalled || []), entry.finalResponse || null,
         entry.confidenceScore ?? null, !!entry.escalatedToHuman]
      )
    },

    async getPendingSupplierOrders({ limit = 20 } = {}) {
      const { rows } = await pool.query(
        `SELECT * FROM ml_orders WHERE supplier_order_status = 'pending_supplier_order' ORDER BY created_at LIMIT $1`,
        [Math.min(Math.max(limit, 1), 100)]
      )
      return rows
    },

    async updateSupplierOrderStatus(id, status) {
      await pool.query(
        'UPDATE ml_orders SET supplier_order_status = $2, updated_at = now() WHERE id = $1',
        [id, status]
      )
    },

    async upsertApproval(a) {
      const { rows } = await pool.query(
        `INSERT INTO supplier_purchase_approvals (order_source, external_order_id, items_json,
                                                  total_cost_usd, status, approval_token)
         VALUES ($1,$2,$3::jsonb,$4,$5,$6)
         ON CONFLICT (external_order_id) DO UPDATE SET status = EXCLUDED.status,
             approval_token = EXCLUDED.approval_token, items_json = EXCLUDED.items_json,
             total_cost_usd = EXCLUDED.total_cost_usd
         RETURNING *`,
        [a.orderSource, a.externalOrderId, JSON.stringify(a.items || []), a.totalCostUsd,
         a.status, a.approvalToken || null]
      )
      return rows[0]
    },

    async getApprovalById(id) {
      const { rows } = await pool.query('SELECT * FROM supplier_purchase_approvals WHERE id = $1', [id])
      return rows[0] || null
    },

    async getApprovalByToken(token) {
      const { rows } = await pool.query('SELECT * FROM supplier_purchase_approvals WHERE approval_token = $1', [token])
      return rows[0] || null
    },

    async resolveApproval(id, status, externalRef = null) {
      await pool.query(
        `UPDATE supplier_purchase_approvals SET status = $2, resolved_at = now()
          WHERE id = $1 AND status IN ('pending_approval','approved')`,
        [id, status]
      )
      if (externalRef) {
        await pool.query(
          `UPDATE ml_orders SET supplier_order_status = $2, updated_at = now()
            WHERE id::text = $1`,
          [externalRef, status === 'rejected' ? 'cancelled' : 'ordered']
        )
      }
    },
  }
}
