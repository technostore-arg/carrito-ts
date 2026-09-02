/**
 * server/ingesta/pricing.js — Cálculo de precio de venta a partir de costo
 * Aplica: +100 USD para celulares/computadoras/notebooks + comisión MercadoPago siempre + margen extra opcional
 * Mantiene costo_original en especificaciones para auditoría y preview.
 */

const DEFAULT_USD_RATE = Number(process.env.USD_ARS_RATE) || 1200 // ARS por USD, editable desde UI
const DEFAULT_MP_FEE = Number(process.env.MP_FEE_PERCENT) || 6.5 // %
const DEFAULT_FIXED_USD = 100

const FIXED_CATEGORIES = new Set(['celulares', 'computadoras', 'notebooks'])

export function getDefaultPricing() {
  return {
    esCosto: false,
    usdRate: DEFAULT_USD_RATE,
    mpFeePercent: DEFAULT_MP_FEE,
    fixedUsd: DEFAULT_FIXED_USD, // USD fijos para celulares/computadoras
    margenExtraPercent: 0, // margen global extra, configurable por usuario
  }
}

/**
 * Aplica pricing a una lista de productos normalizados.
 * @param {any[]} productos - array de Producto (con precio = costo si esCosto)
 * @param {object} opts
 * @param {boolean} opts.esCosto
 * @param {number} opts.usdRate
 * @param {number} opts.mpFeePercent - ej 6.5
 * @param {number} opts.fixedUsd - USD fijos para categorías premium
 * @param {number} opts.margenExtraPercent - % extra global (ej 10 = 10%)
 * @param {Record<string,number>} opts.margenPorCategoria - opcional, sobrescribe por categoría
 * @returns {{productos: any[], detalle: any[]}}
 */
export function applyPricing(productos, opts = {}) {
  const cfg = { ...getDefaultPricing(), ...opts }
  // Si no es costo, no tocar
  if (!cfg.esCosto) return { productos, detalle: [] }

  const mpFee = Number(cfg.mpFeePercent) / 100
  const margenExtra = Number(cfg.margenExtraPercent) / 100
  const usdRate = Number(cfg.usdRate) || DEFAULT_USD_RATE
  const fixedUsd = Number(cfg.fixedUsd) || 0

  const detalle = []

  const out = productos.map(p => {
    // encargo sin precio no se toca
    if (p.tipo_venta === 'encargo' || Number(p.precio) <= 0) {
      detalle.push({ sku: p.sku, costo: p.precio, precioFinal: p.precio, nota: 'encargo sin margen' })
      return p
    }
    const costo = Number(p.precio) || 0
    const categoria = String(p.categoria || '').toLowerCase()
    const aplicaFijo = FIXED_CATEGORIES.has(categoria)
    const fijoArs = aplicaFijo ? fixedUsd * usdRate : 0

    // margen por categoría si viene
    let margenCat = 0
    if (cfg.margenPorCategoria && typeof cfg.margenPorCategoria === 'object') {
      const v = cfg.margenPorCategoria[categoria]
      if (v != null) margenCat = Number(v) / 100
    }

    const base = costo + fijoArs
    // Gross-up MP: si MP cobra 6.5%, para recibir base necesitás base / (1 - 0.065)
    const conMP = mpFee > 0 && mpFee < 0.9 ? base / (1 - mpFee) : base
    const conMargenExtra = conMP * (1 + margenExtra)
    const conMargenCat = conMargenExtra * (1 + margenCat)
    const precioFinal = Math.round(conMargenCat)

    detalle.push({
      sku: p.sku,
      categoria,
      costo,
      fijoUsd: aplicaFijo ? fixedUsd : 0,
      fijoArs,
      base,
      conMP: Math.round(conMP),
      precioFinal,
      usdRate,
      mpFeePercent: cfg.mpFeePercent,
    })

    // Guardar auditoría en especificaciones sin romper schema
    const especificaciones = {
      ...(p.especificaciones || {}),
      _costo_original: costo,
      _pricing: {
        esCosto: true,
        costo,
        fijoUsd: aplicaFijo ? fixedUsd : 0,
        usdRate,
        mpFeePercent: cfg.mpFeePercent,
        margenExtraPercent: cfg.margenExtraPercent,
        precioFinal,
      },
    }

    return {
      ...p,
      precio: precioFinal,
      costo_original: costo, // campo no canónico pero útil para preview, se ignora en validación
      especificaciones,
    }
  })

  return { productos: out, detalle }
}

/**
 * Calcula pricing inverso para mostrar en preview: cuánto es costo vs precio final
 */
export function explainPricing(detalle) {
  return detalle.map(d => {
    if (d.costo === d.precioFinal) return `${d.sku}: $${d.costo} (encargo/sin margen)`
    const partes = [`costo $${d.costo}`]
    if (d.fijoArs) partes.push(`+ $${d.fijoArs} (USD ${d.fijoUsd} × ${d.usdRate})`)
    partes.push(`+ MP ${d.mpFeePercent}% → $${d.precioFinal}`)
    return `${d.sku}: ${partes.join(' ')}`
  })
}
