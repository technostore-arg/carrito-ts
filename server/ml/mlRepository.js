/** Repositorio PostgreSQL de la Fase 3 (mismo patrón inyectable que server/hub). */
import { getPricingConfig } from '../hub/repository.js'
import { DEFAULT_ML_CONFIG } from './mlPricingAndSync.js'

export function createMlRepository(pool) {
  const parseJson = v => (typeof v === 'string' ? JSON.parse(v) : (v || {}))

  return {
    async getMlConfig() {
      const { rows } = await pool.query('SELECT ml_config_json FROM pricing_config WHERE id = 1')
      return { ...DEFAULT_ML_CONFIG, ...parseJson(rows[0]?.ml_config_json) }
    },

    async getMlCredential() {
      const { rows } = await pool.query('SELECT * FROM ml_credentials ORDER BY updated_at DESC LIMIT 1')
      return rows[0] || null
    },

    async saveMlCredential(c) {
      const { rows } = await pool.query(
        `INSERT INTO ml_credentials (user_id, access_token, refresh_token, expires_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at,
           updated_at = now()
         RETURNING *`,
        [c.userId, c.accessToken, c.refreshToken, c.expiresAt]
      )
      return rows[0]
    },

    /** Lote paginado del Hub con el mismo shape que consume computeQuote. */
    async getHubBatch({ limit = 50, offset = 0 } = {}) {
      const config = await getPricingConfig(pool)
      const { rows: masters } = await pool.query(
        `SELECT id, ean, mpn, sku_interno, title, brand, category, vat_rate, static_data_json
           FROM master_products WHERE is_active = TRUE ORDER BY id LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
      if (!masters.length) return []
      const { rows: listings } = await pool.query(
        `SELECT * FROM supplier_listings WHERE master_product_id = ANY($1)`,
        [masters.map(m => m.id)]
      )
      const byMaster = new Map()
      for (const l of listings) {
        if (!byMaster.has(l.master_product_id)) byMaster.set(l.master_product_id, [])
        byMaster.get(l.master_product_id).push({
          supplierCode: l.supplier_code,
          supplierSku: l.supplier_sku,
          costAmount: l.cost_amount == null ? null : Number(l.cost_amount),
          costCurrency: l.cost_currency,
          rawStock: Number(l.raw_stock) || 0,
          prevCostAmount: l.prev_cost_amount == null ? null : Number(l.prev_cost_amount),
          quarantineReason: l.quarantine_reason,
        })
      }
      return masters.map(m => ({
        master_product: {
          id: m.id, sku: m.sku_interno, ean: m.ean, mpn: m.mpn,
          title: m.title, brand: m.brand, category: m.category,
          vatRate: Number(m.vat_rate), staticData: parseJson(m.static_data_json),
        },
        supplier_listings: byMaster.get(m.id) || [],
        pricing_config: config,
      }))
    },

    async getMlListing(masterProductId) {
      const { rows } = await pool.query('SELECT * FROM ml_listings WHERE master_product_id = $1', [masterProductId])
      return rows[0] || null
    },

    async getMlListingByItemId(mlItemId) {
      const { rows } = await pool.query('SELECT * FROM ml_listings WHERE ml_item_id = $1', [String(mlItemId)])
      return rows[0] || null
    },

    async upsertMlListing(l) {
      await pool.query(
        `INSERT INTO ml_listings (master_product_id, ml_item_id, listing_type_id, published_price,
                                  published_stock, manufacturing_days, status, last_synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (master_product_id) DO UPDATE SET
           ml_item_id = COALESCE(EXCLUDED.ml_item_id, ml_listings.ml_item_id),
           listing_type_id = EXCLUDED.listing_type_id,
           published_price = EXCLUDED.published_price,
           published_stock = EXCLUDED.published_stock,
           manufacturing_days = EXCLUDED.manufacturing_days,
           status = EXCLUDED.status, last_synced_at = EXCLUDED.last_synced_at,
           updated_at = now()`,
        [l.masterProductId, l.mlItemId || null, l.listingTypeId || 'gold_special',
         l.publishedPrice ?? null, l.publishedStock ?? 0, l.manufacturingDays ?? 0,
         l.status || 'active', l.lastSyncedAt || new Date().toISOString()]
      )
    },

    /** Idempotencia real: ON CONFLICT DO NOTHING. Devuelve si fue insertado. */
    async insertWebhookEvent(e) {
      const { rowCount } = await pool.query(
        `INSERT INTO ml_webhook_events (event_key, topic, resource, payload_json)
         VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (event_key) DO NOTHING`,
        [e.eventKey, e.topic, e.resource || null, JSON.stringify(e.payloadJson || {})]
      )
      return rowCount > 0
    },

    async getPendingWebhookEvents({ limit = 20 } = {}) {
      const { rows } = await pool.query(
        `SELECT id, event_key, topic, resource, payload_json, status, created_at
           FROM ml_webhook_events
          WHERE status = 'pending' AND processed_at IS NULL
          ORDER BY created_at LIMIT $1`,
        [limit]
      )
      return rows
    },

    async markWebhookEvent(eventKey, status, extra = {}) {
      await pool.query(
        `UPDATE ml_webhook_events SET status = $2, processed_at = COALESCE($3, processed_at),
                error_message = $4 WHERE event_key = $1`,
        [eventKey, status, extra.processedAt || null, extra.errorMessage || null]
      )
    },

    /** Descuenta stock del origen correcto y devuelve fulfillment_source. */
    async decrementStock({ masterProductId, quantity }) {
      const qty = Math.max(1, Number(quantity) || 1)
      const { rows } = await pool.query(
        `SELECT supplier_code, raw_stock FROM supplier_listings WHERE master_product_id = $1 AND supplier_code = 'LOCAL'`,
        [masterProductId]
      )
      const local = rows[0]
      if (local && Number(local.raw_stock) >= qty) {
        await pool.query(
          `UPDATE supplier_listings SET raw_stock = raw_stock - $2, updated_at = now()
            WHERE master_product_id = $1 AND supplier_code = 'LOCAL'`,
          [masterProductId, qty]
        )
        return { fulfillmentSource: 'local' }
      }
      await pool.query(
        `UPDATE supplier_listings SET raw_stock = GREATEST(0, raw_stock - $2), updated_at = now()
          WHERE master_product_id = $1 AND supplier_code = 'ELIT'`,
        [masterProductId, qty]
      )
      return { fulfillmentSource: 'supplier' }
    },

    async upsertMlOrder(o) {
      await pool.query(
        `INSERT INTO ml_orders (ml_order_id, master_product_id, quantity, total_amount,
                                fulfillment_source, supplier_order_status, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (ml_order_id) DO UPDATE SET quantity = EXCLUDED.quantity,
           total_amount = EXCLUDED.total_amount, supplier_order_status = EXCLUDED.supplier_order_status,
           payload_json = EXCLUDED.payload_json, updated_at = now()`,
        [o.mlOrderId, o.masterProductId || null, o.quantity || 1, o.totalAmount || 0,
         o.fulfillmentSource, o.supplierOrderStatus || 'none', JSON.stringify(o.payloadJson || {})]
      )
    },

    async logSync(s) {
      await pool.query(
        `INSERT INTO sync_logs (job_name, supplier_code, status, items_processed, error_message, payload_json, finished_at)
         VALUES ($1,'MLA',$2,$3,$4,$5::jsonb, now())`,
        [s.job || 'ml-sync', s.status || 'ok', s.processed || 0, s.errors?.join(' | ') || null, JSON.stringify(s)]
      )
    },
  }
}
