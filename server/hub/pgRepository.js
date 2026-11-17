/** Repositorio PostgreSQL usado por los workers y por el CLI. */
import { getPricingConfig } from './repository.js'

export function createPgRepository(pool) {
  return {
    getConfig: () => getPricingConfig(pool),

    async findMaster({ ean, mpn, supplierSku }) {
      const { rows } = await pool.query(
        `SELECT * FROM master_products
          WHERE ($1::text IS NOT NULL AND ean = $1)
             OR ($2::text IS NOT NULL AND mpn = $2)
             OR sku_interno = $3
          LIMIT 1`,
        [ean || null, mpn || null, `ELIT-${supplierSku}`]
      )
      const row = rows[0]
      return row ? { ...row, sku: row.sku_interno } : null
    },

    async upsertMaster(m) {
      const { rows } = await pool.query(
        `INSERT INTO master_products (ean, mpn, sku_interno, title, brand, category, vat_rate, static_data_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (sku_interno) DO UPDATE SET
           ean = COALESCE(EXCLUDED.ean, master_products.ean),
           mpn = COALESCE(EXCLUDED.mpn, master_products.mpn),
           title = EXCLUDED.title, brand = EXCLUDED.brand,
           category = EXCLUDED.category, vat_rate = EXCLUDED.vat_rate,
           static_data_json = EXCLUDED.static_data_json, updated_at = now()
         RETURNING id, sku_interno AS sku, ean, mpn, title, brand, category, vat_rate`,
        [m.ean || null, m.mpn || null, m.sku, m.title, m.brand, m.category, m.vatRate, JSON.stringify(m.staticData || {})]
      )
      return rows[0]
    },

    async findListing(supplierCode, supplierSku) {
      const { rows } = await pool.query(
        `SELECT * FROM supplier_listings WHERE supplier_code = $1 AND supplier_sku = $2 LIMIT 1`,
        [supplierCode, supplierSku]
      )
      return rows[0] || null
    },

    async upsertListing(masterRef, l) {
      let masterId = masterRef
      if (!Number.isFinite(Number(masterId))) {
        const { rows } = await pool.query('SELECT id FROM master_products WHERE sku_interno = $1', [String(masterRef)])
        if (!rows[0]) throw new Error(`Master no encontrado: ${masterRef}`)
        masterId = rows[0].id
      }
      await pool.query(
        `INSERT INTO supplier_listings
          (master_product_id, supplier_code, supplier_sku, cost_amount, cost_currency, raw_stock,
           last_synced_at, prev_cost_amount, quarantine_reason, quarantined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $9 IS NOT NULL THEN now() ELSE NULL END)
         ON CONFLICT (supplier_code, supplier_sku) DO UPDATE SET
           cost_amount = EXCLUDED.cost_amount,
           cost_currency = EXCLUDED.cost_currency,
           raw_stock = EXCLUDED.raw_stock,
           last_synced_at = EXCLUDED.last_synced_at,
           prev_cost_amount = CASE WHEN EXCLUDED.quarantine_reason IS NOT NULL
                                   THEN EXCLUDED.prev_cost_amount ELSE NULL END,
           quarantine_reason = EXCLUDED.quarantine_reason,
           quarantined_at = CASE WHEN EXCLUDED.quarantine_reason IS NOT NULL THEN now() ELSE NULL END,
           updated_at = now()`,
        [masterId, l.supplierCode, l.supplierSku, l.costAmount, l.costCurrency, l.rawStock,
         l.lastSyncedAt || new Date().toISOString(), l.prevCostAmount ?? null, l.quarantineReason || null]
      )
    },

    async log(s) {
      await pool.query(
        `INSERT INTO sync_logs (job_name, supplier_code, status, items_processed, items_quarantined,
                                error_message, payload_json, finished_at, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb, now(), $8)`,
        [s.job, s.supplier || 'ELIT', s.status || 'ok', s.processed || 0, s.quarantined || 0,
         s.errors?.join(' | ') || null, JSON.stringify(s), s.durationMs || null]
      )
    },
  }
}
