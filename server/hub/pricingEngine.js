/**
 * server/hub/pricingEngine.js — Motor puro de precios y disponibilidad.
 *
 * Reglas de negocio:
 *  1. Prioridad de stock: LOCAL con stock > 0 → 'local'. Si no, ELIT con
 *     stock >= safetyStockThreshold (3) → 'supplier'. Si no → stock 0.
 *  2. IVA discriminado: 10.5% hardware core / 21% periféricos y accesorios.
 *  3. transfer_price = (costo en ARS + IVA) * (1 + margen por categoría).
 *     Si la ganancia resultante es menor al piso absoluto (minAbsoluteProfit),
 *     se eleva el precio hasta asegurar esa ganancia mínima — los productos
 *     baratos no pueden venderse con margen porcentual porque el envío fijo
 *     se come la ganancia.
 *     list_price = transfer_price * (1 + recargo financiero %).
 *  4. Cuarentena: costo <= 0, moneda inválida o caída >= 40% vs. el costo
 *     anterior → no se publica. Se intenta el siguiente proveedor elegible.
 *
 * Es una función pura: no hace IO, no lee env, no muta sus argumentos.
 * @typedef {'local'|'supplier'} StockSource
 */

export const VAT_CORE = 0.105
export const VAT_GENERAL = 0.21
export const MAX_PRICE_DROP_RATIO = 0.4

/** Categorías con alícuota reducida (hardware core). */
export const CORE_HARDWARE_CATEGORIES = new Set([
  'notebooks', 'notebook', 'laptops', 'procesadores', 'cpu', 'cpus',
  'motherboard', 'motherboards', 'mothers', 'ram', 'ram-sodimm', 'memorias',
  'ssd', 'ssd-nvme', 'ssd-sata', 'almacenamiento', 'discos', 'storage',
  'computadoras',
  // Categorías genéricas de tecnología / alias de Elit (fallback cuando Elit no informa IVA).
  'computacion', 'componentes', 'gpus', 'placas-de-video', 'tarjetas-de-video',
  'memorias-ram', 'memoria-ram', 'discos-rigidos', 'unidades-de-estado-solido',
  'workstations', 'servidores',
])

export const DEFAULT_CONFIG = Object.freeze({
  usdArsRate: 1550,
  // Recargo para precio en tarjeta. La pasarela descuenta ~16,67% de lo cobrado
  // (referencia real: cobro $300.000 en 3 cuotas, acreditado ~$250.000).
  // Con 16% se perdía ~3,4% vs. transferencia; 20% compensa exactamente el descuento.
  listSurchargePercent: 20,
  safetyStockThreshold: 3,
  // Ganancia mínima absoluta sobre costo con IVA (ARS). Evita vender barato "a pérdida" por el envío.
  minAbsoluteProfit: 20000,
  categoryMargins: { default: 0.20 },
  vatByCategory: {},
})

/** @param {string} cat */
function normCat(cat) { return String(cat || '').toLowerCase().trim() }

/**
 * @param {string} category
 * @param {object} config
 * @returns {number}
 */
export function vatRateFor(category, config = {}) {
  const cat = normCat(category)
  const override = config.vatByCategory?.[cat]
  if (override != null && Number(override) > 0) return Number(override)
  return CORE_HARDWARE_CATEGORIES.has(cat) ? VAT_CORE : VAT_GENERAL
}

/** @param {string} category @param {object} config */
export function marginFor(category, config = {}) {
  const margins = config.categoryMargins || {}
  const value = margins[normCat(category)] ?? margins.default ?? DEFAULT_CONFIG.categoryMargins.default
  return Number(value) || 0
}

/**
 * @param {number} amount
 * @param {string} currency
 * @param {number} usdRate
 * @returns {number|null}
 */
export function toArs(amount, currency, usdRate) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return null
  const cur = String(currency || 'ARS').toUpperCase()
  if (cur === 'ARS') return n
  if (cur === 'USD') return n * (Number(usdRate) || DEFAULT_CONFIG.usdArsRate)
  return null
}

/**
 * Detecta condiciones de cuarentena para un listing.
 * @param {object} listing
 * @returns {string|null} motivo (null = OK)
 */
export function quarantineReason(listing) {
  if (listing?.quarantineReason) return String(listing.quarantineReason)
  const cost = Number(listing?.costAmount)
  if (!Number.isFinite(cost) || cost <= 0) return 'COSTO_CERO_O_INVALIDO'
  const cur = String(listing?.costCurrency || '').toUpperCase()
  if (!['ARS', 'USD'].includes(cur)) return 'MONEDA_INVALIDA'
  if (Number(listing?.rawStock) < 0) return 'STOCK_NEGATIVO'
  const prev = Number(listing?.prevCostAmount)
  if (prev > 0 && cost < prev * (1 - MAX_PRICE_DROP_RATIO)) {
    return `CAIDA_PRECIO_${Math.round((1 - cost / prev) * 100)}%`
  }
  return null
}

/**
 * Elige el proveedor activo respetando prioridad y cuarentena.
 * @param {object[]} listings
 * @param {object} config
 */
export function pickActiveListing(listings, config = {}) {
  const threshold = Number(config.safetyStockThreshold ?? DEFAULT_CONFIG.safetyStockThreshold)
  const reasons = []
  const local = (listings || []).find(l => String(l.supplierCode).toUpperCase() === 'LOCAL')
  const elit = (listings || []).find(l => String(l.supplierCode).toUpperCase() === 'ELIT')

  const candidates = [
    { listing: local, source: 'local', eligible: Number(local?.rawStock) > 0 },
    { listing: elit, source: 'supplier', eligible: Number(elit?.rawStock) >= threshold },
  ]

  for (const c of candidates) {
    if (!c.listing || !c.eligible) continue
    const reason = quarantineReason(c.listing)
    if (reason) { reasons.push(`${c.source}:${reason}`); continue }
    return {
      listing: c.listing,
      stock: Math.max(0, Math.floor(Number(c.listing.rawStock))),
      source: c.source,
      activeSupplier: c.source === 'local' ? 'LOCAL' : 'ELIT',
      quarantineReasons: [],
    }
  }
  return { listing: null, stock: 0, source: null, activeSupplier: null, quarantineReasons: reasons }
}

/**
 * Calcula el quote exacto que consume el frontend.
 * @param {{master_product:object, supplier_listings:object[], pricing_config?:object}} input
 * @returns {object} { sku, price_transfer, price_list, stock, stock_source, active_supplier, ... }
 */
export function computeQuote(input = {}) {
  const master = input.master_product || {}
  const config = { ...DEFAULT_CONFIG, ...(input.pricing_config || {}) }
  const sku = String(master.sku || master.sku_interno || '')
  // IVA real del producto (Elit) cuando está disponible; si no, regla por categoría.
  const vatRate = Number(master.vatRate) > 0 ? Number(master.vatRate) : vatRateFor(master.category, config)
  const margin = marginFor(master.category, config)
  const base = {
    sku,
    vat_rate: vatRate,
    margin,
    price_transfer: null,
    price_list: null,
    stock: 0,
    stock_source: null,
    active_supplier: null,
    quarantined: false,
    quarantine_reasons: [],
  }

  const picked = pickActiveListing(input.supplier_listings || [], config)
  if (!picked.listing) {
    return {
      ...base,
      quarantined: picked.quarantineReasons.length > 0,
      quarantine_reasons: picked.quarantineReasons,
    }
  }

  const costArs = toArs(picked.listing.costAmount, picked.listing.costCurrency, config.usdArsRate)
  if (costArs == null) {
    return { ...base, quarantined: true, quarantine_reasons: ['COSTO_CERO_O_INVALIDO'] }
  }

  const costWithVat = costArs * (1 + vatRate)
  let priceTransfer = Math.round(costWithVat * (1 + margin))
  const minProfit = Math.max(0, Number(config.minAbsoluteProfit ?? DEFAULT_CONFIG.minAbsoluteProfit) || 0)
  if (minProfit > 0 && priceTransfer - costWithVat < minProfit) {
    priceTransfer = Math.round(costWithVat + minProfit)
  }
  const surcharge = Number(config.listSurchargePercent) || 0
  const priceList = Math.round(priceTransfer * (1 + surcharge / 100))

  return {
    ...base,
    cost_ars: Math.round(costArs * 100) / 100,
    cost_with_vat: Math.round(costWithVat),
    min_profit_applied: priceTransfer - Math.round(costWithVat) >= minProfit,
    price_transfer: priceTransfer,
    price_list: priceList,
    stock: picked.stock,
    stock_source: picked.source,
    active_supplier: picked.activeSupplier,
  }
}

/**
 * Adaptador a las claves que hoy consume el front (legacy).
 * @param {object} quote
 */
export function toLegacyQuote(quote) {
  return {
    precio_transferencia: quote.price_transfer,
    precio_mercadopago: quote.price_list,
    precio_lista: quote.price_list,
    stock: quote.stock,
    stock_source: quote.stock_source,
    active_supplier: quote.active_supplier,
    vat_rate: quote.vat_rate,
    quarantined: quote.quarantined,
  }
}
