/** Lecturas del hub para el endpoint `/api/products/live`. */
import { getPgPool } from './pg.js'

/** @returns {Promise<object>} configuración en camelCase */
export async function getPricingConfig(client = null) {
  const db = client || getPgPool()
  const { rows } = await db.query('SELECT * FROM pricing_config WHERE id = 1')
  const r = rows[0] || {}
  return {
    usdArsRate: Number(r.usd_ars_rate) || 1550,
    listSurchargePercent: Number(r.list_surcharge_percent) || 16,
    safetyStockThreshold: Number(r.safety_stock_threshold) || 3,
    // Piso de ganancia absoluta; DEFAULT_CONFIG aporta 20000 si la columna no existe aún.
    ...(r.min_absolute_profit != null ? { minAbsoluteProfit: Number(r.min_absolute_profit) } : {}),
    categoryMargins: typeof r.category_margins === 'string' ? JSON.parse(r.category_margins) : (r.category_margins || {}),
    vatByCategory: typeof r.vat_by_category === 'string' ? JSON.parse(r.vat_by_category) : (r.vat_by_category || {}),
  }
}

/**
 * Trae maestros + listings para los SKU pedidos. Una sola query evita N+1.
 * @param {string[]} skus
 * @param {object} config
 */
export async function getQuoteInputs(skus, config) {
  const db = getPgPool()
  const ids = [...new Set((skus || []).map(String))].slice(0, 200)
  if (!ids.length) return []
  const { rows: masters } = await db.query(
    `SELECT id, ean, mpn, sku_interno, title, brand, category, vat_rate, static_data_json, is_active
       FROM master_products WHERE sku_interno = ANY($1) AND is_active = TRUE`,
    [ids]
  )
  if (!masters.length) return []
  const { rows: listings } = await db.query(
    `SELECT id, master_product_id, supplier_code, supplier_sku, cost_amount, cost_currency,
            raw_stock, last_synced_at, prev_cost_amount, prev_cost_currency, quarantine_reason
       FROM supplier_listings WHERE master_product_id = ANY($1)`,
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
      lastSyncedAt: l.last_synced_at,
      prevCostAmount: l.prev_cost_amount == null ? null : Number(l.prev_cost_amount),
      prevCostCurrency: l.prev_cost_currency,
      quarantineReason: l.quarantine_reason,
    })
  }
  return masters.map(m => ({
    master_product: {
      id: m.id, ean: m.ean, mpn: m.mpn, sku: m.sku_interno, title: m.title,
      brand: m.brand, category: m.category, vatRate: Number(m.vat_rate),
      staticData: m.static_data_json || {},
    },
    supplier_listings: byMaster.get(m.id) || [],
    pricing_config: config,
  }))
}
