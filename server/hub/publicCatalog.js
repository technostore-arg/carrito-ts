/**
 * Catálogo público desde el Hub PostgreSQL.
 * Mapea master_products + computeQuote al shape que ya consume el front.
 */
import { computeQuote } from './pricingEngine.js'
import { getPricingConfig } from './repository.js'

const parseJson = v => (typeof v === 'string' ? JSON.parse(v) : (v || {}))

/** @param {object} input @returns {object} producto shape API */
export function buildPublicProduct(input) {
  const quote = computeQuote(input)
  if (quote.quarantined || quote.price_transfer == null) return null
  const m = input.master_product
  const staticData = m.staticData || {}
  const imagenes = Array.isArray(staticData.imagenes) ? staticData.imagenes : staticData.imagen ? [staticData.imagen] : []
  return {
    id: m.sku,
    sku: m.sku,
    name: m.title,
    nombre: m.title,
    brand: m.brand || 'Genérica',
    marca: m.brand || 'Genérica',
    fabricante: m.brand || 'Genérica',
    category: m.category,
    categoria: m.category,
    price: quote.price_transfer,
    precio: quote.price_transfer,
    precio_transferencia: quote.price_transfer,
    precio_mercadopago: quote.price_list,
    precio_lista: quote.price_list,
    stock: quote.stock,
    stock_source: quote.stock_source || 'local',
    active: true,
    estado: quote.stock > 0 ? 'activo' : 'agotado',
    visibleEnTienda: true,
    tipo_venta: 'directa',
    moneda: 'ARS',
    condicion: 'nuevo',
    imagenes,
    image: imagenes[0] || null,
    descripcion: staticData.descripcion || staticData.description || '',
    description: staticData.descripcion || '',
    especificaciones: staticData.especificaciones || {},
    specs: Array.isArray(staticData.specs) ? staticData.specs : [],
    rating: 4.5,
    reviews: 0,
    fuente_origen: 'elit',
    vat_rate: quote.vat_rate,
    updatedAt: new Date().toISOString(),
  }
}

/** @param {object[]} inputs */
export function buildPublicCatalog(inputs = []) {
  const out = []
  for (const input of inputs) {
    const p = buildPublicProduct(input)
    if (p) out.push(p)
  }
  return out
}

/** Carga los inputs del hub para el catálogo público. */
export async function loadPublicInputs(pool, { limit = 500, sku = null } = {}) {
  const config = await getPricingConfig(pool)
  const params = [Math.min(Math.max(limit, 1), 1000)]
  let where = 'is_active = TRUE'
  if (sku) { where += ' AND (sku_interno = $2 OR CAST(id AS TEXT) = $2)'; params.push(String(sku)) }
  const { rows } = await pool.query(
    `SELECT id, sku_interno, ean, mpn, title, brand, category, vat_rate, static_data_json
       FROM master_products WHERE ${where} ORDER BY id LIMIT $1`, params
  )
  if (!rows.length) return []
  const { rows: listings } = await pool.query(
    'SELECT * FROM supplier_listings WHERE master_product_id = ANY($1)', [rows.map(r => r.id)]
  )
  return rows.map(r => ({
    master_product: {
      id: r.id, sku: r.sku_interno, ean: r.ean, mpn: r.mpn, title: r.title,
      brand: r.brand, category: r.category, vatRate: Number(r.vat_rate),
      staticData: parseJson(r.static_data_json),
    },
    supplier_listings: listings.filter(l => l.master_product_id === r.id).map(l => ({
      supplierCode: l.supplier_code,
      supplierSku: l.supplier_sku,
      costAmount: l.cost_amount == null ? null : Number(l.cost_amount),
      costCurrency: l.cost_currency,
      rawStock: Number(l.raw_stock) || 0,
      prevCostAmount: l.prev_cost_amount == null ? null : Number(l.prev_cost_amount),
      quarantineReason: l.quarantine_reason,
    })),
    pricing_config: config,
  }))
}

export async function getPublicCatalogFromHub(pool) {
  return buildPublicCatalog(await loadPublicInputs(pool))
}

export async function getPublicProductFromHub(skuOrId, pool) {
  const inputs = await loadPublicInputs(pool, { sku: skuOrId, limit: 1 })
  return inputs.length ? buildPublicProduct(inputs[0]) : null
}
