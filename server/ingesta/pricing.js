/**
 * server/ingesta/pricing.js — Dual pricing: transferencia + MercadoPago
 *
 * Reglas:
 *  - InsumosAcuario: costo × 1.20 = transferencia, transferencia × 1.16 = MP
 *  - Celulares/Notebooks/Computadoras: (costo + 100 USD × 1200) = transferencia, transferencia × 1.16 = MP
 *  - Otros (GPU, RAM, SSD, etc): costo = transferencia, transferencia × 1.16 = MP
 */

const DEFAULT_USD_RATE = Number(process.env.USD_ARS_RATE) || 1200
const DEFAULT_MP_FEE = Number(process.env.MP_FEE_PERCENT) || 6.5
const DEFAULT_FIXED_USD = 100
const MP_MARKUP = 0.16 // 16% extra for MercadoPago

const FIXED_CATEGORIES = new Set(['celulares', 'computadoras', 'notebooks'])
const SCRAPE_SOURCES = new Set(['scraping_insumosacuario'])

export function getDefaultPricing() {
  return {
    esCosto: false,
    usdRate: DEFAULT_USD_RATE,
    mpFeePercent: DEFAULT_MP_FEE,
    fixedUsd: DEFAULT_FIXED_USD,
    margenExtraPercent: 0,
  }
}

/**
 * Calculate dual pricing for a product.
 * @returns {{ transferencia: number, mercadopago: number }}
 */
function calcDualPrecio(costo, categoria, fuente_origen) {
  const cat = String(categoria || '').toLowerCase()
  const fuente = String(fuente_origen || '').toLowerCase()

  let transferencia = 0

  if (SCRAPE_SOURCES.has(fuente)) {
    // InsumosAcuario: +20% over scraped price
    transferencia = Math.round(costo * 1.20)
  } else if (FIXED_CATEGORIES.has(cat)) {
    // Celulares/Notebooks/Computadoras: +100 USD fixed
    transferencia = Math.round(costo + DEFAULT_FIXED_USD * DEFAULT_USD_RATE)
  } else {
    // GPU, RAM, SSD, etc: cost = transferencia
    transferencia = Math.round(costo)
  }

  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))

  return { transferencia, mercadopago }
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
    const { transferencia, mercadopago } = calcDualPrecio(costo, p.categoria, p.fuente_origen)

    detalle.push({
      sku: p.sku,
      categoria: p.categoria,
      fuente_origen: p.fuente_origen,
      costo,
      transferencia,
      mercadopago,
      usdRate,
    })

    const especificaciones = {
      ...(p.especificaciones || {}),
      _costo_original: costo,
      _pricing: { costo, transferencia, mercadopago, usdRate },
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
