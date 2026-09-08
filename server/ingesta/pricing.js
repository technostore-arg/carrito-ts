/**
 * server/ingesta/pricing.js — Dual pricing: transferencia + MercadoPago
 *
 * Reglas:
 *  - InsumosAcuario: costo × 1.20 = transferencia, transferencia × 1.16 = MP
 *  - Celulares/Notebooks/Computadoras: (costo + fijo USD × USD_ARS_RATE) = transferencia,
 *    transferencia × 1.16 = MP. Fijo por tramos de costo en USD:
 *    < U$S 250 → +50 | U$S 250–400 → +80 | > U$S 400 → +100
 *  - Otros (GPU, RAM, SSD, etc): costo = transferencia, transferencia × 1.16 = MP
 */

const DEFAULT_USD_RATE = Number(process.env.USD_ARS_RATE) || 1550
const DEFAULT_MP_FEE = Number(process.env.MP_FEE_PERCENT) || 6.5
const MP_MARKUP = 0.16 // 16% extra for MercadoPago

const FIXED_CATEGORIES = new Set(['celulares', 'computadoras', 'notebooks'])
const SCRAPE_SOURCES = new Set(['scraping_insumosacuario'])

/**
 * Fijo en USD según tramo de costo (en USD). Si se pasa override manual, se usa ese.
 * Tramos: costo < 250 → 50 | 250–400 → 80 | > 400 → 100
 */
export function fixedUsdFor(usdCost, override = null) {
  if (override != null && override !== '' && Number(override) >= 0) return Number(override)
  const u = Number(usdCost) || 0
  if (u < 250) return 50
  if (u <= 400) return 80
  return 100
}

export function getDefaultPricing() {
  return {
    esCosto: false,
    usdRate: DEFAULT_USD_RATE,
    mpFeePercent: DEFAULT_MP_FEE,
    fixedUsd: null, // null = automático por tramos (50/80/100)
    margenExtraPercent: 0,
  }
}

/**
 * Calculate dual pricing for a product.
 * @returns {{ transferencia: number, mercadopago: number, fixedUsd: number }}
 */
function calcDualPrecio(costo, categoria, fuente_origen, cfg = {}) {
  const cat = String(categoria || '').toLowerCase()
  const fuente = String(fuente_origen || '').toLowerCase()
  const usdRate = Number(cfg.usdRate) || DEFAULT_USD_RATE

  let transferencia = 0
  let fixedUsd = 0

  if (SCRAPE_SOURCES.has(fuente)) {
    // InsumosAcuario: +20% over scraped price
    transferencia = Math.round(costo * 1.20)
  } else if (FIXED_CATEGORIES.has(cat)) {
    // Celulares/Notebooks/Computadoras: +fijo USD por tramo de costo
    const usdCost = costo / usdRate
    fixedUsd = fixedUsdFor(usdCost, cfg.fixedUsd)
    transferencia = Math.round(costo + fixedUsd * usdRate)
  } else {
    // GPU, RAM, SSD, etc: cost = transferencia
    transferencia = Math.round(costo)
  }

  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))

  return { transferencia, mercadopago, fixedUsd }
}

/**
 * Apply dual pricing to a list of normalized products.
 */
export function applyPricing(productos, opts = {}) {
  const cfg = { ...getDefaultPricing(), ...opts }
  if (!cfg.esCosto) return { productos, detalle: [] }

  const usdRate = Number(cfg.usdRate) || DEFAULT_USD_RATE
  const detalle = []

  const out = productos.map(p => {
    if (p.tipo_venta === 'encargo' || Number(p.precio) <= 0) {
      detalle.push({ sku: p.sku, costo: p.precio, transferencia: p.precio, mercadopago: p.precio, nota: 'encargo sin margen' })
      return { ...p, precio_transferencia: p.precio, precio_mercadopago: p.precio }
    }

    const costo = Number(p.precio) || 0
    const { transferencia, mercadopago, fixedUsd } = calcDualPrecio(costo, p.categoria, p.fuente_origen, cfg)

    detalle.push({
      sku: p.sku,
      categoria: p.categoria,
      fuente_origen: p.fuente_origen,
      costo,
      transferencia,
      mercadopago,
      usdRate,
      fixedUsd,
    })

    const especificaciones = {
      ...(p.especificaciones || {}),
      _costo_original: costo,
      _pricing: { costo, transferencia, mercadopago, usdRate, fixedUsd },
    }

    return {
      ...p,
      precio: transferencia,
      precio_transferencia: transferencia,
      precio_mercadopago: mercadopago,
      especificaciones,
    }
  })

  return { productos: out, detalle }
}

export function explainPricing(detalle) {
  return detalle.map(d => {
    if (d.costo === d.transferencia) return `${d.sku}: $${d.costo} (transfer) / $${d.mercadopago} (MP)`
    return `${d.sku}: costo $${d.costo} → transfer $${d.transferencia} / MP $${d.mercadopago}`
  })
}
