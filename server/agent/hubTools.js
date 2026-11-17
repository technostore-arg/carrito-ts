/**
 * server/agent/hubTools.js — Herramientas deterministas (grounded) del Hub.
 * Ninguna herramienta usa el LLM: sólo datos del repositorio + pricingEngine.
 */
import { computeQuote } from '../hub/pricingEngine.js'

/** @param {object} repo @param {object} config */
export function createHubTools(repo, config = {}) {
  const baseUrl = config.storeBaseUrl || process.env.STORE_BASE_URL || 'https://technostore.ar'

  const dispatchLabel = quote => {
    if (Number(quote.stock) <= 0 || quote.quarantined) return 'Sin stock'
    return quote.stock_source === 'supplier' ? 'Despacho 24-48 hs' : 'Retiro hoy'
  }

  const compact = (input, quote) => ({
    sku: input.master_product.sku,
    title: input.master_product.title,
    brand: input.master_product.brand,
    category: input.master_product.category,
    price_transfer: quote.price_transfer,
    price_list: quote.price_list,
    stock: quote.stock,
    stock_source: quote.stock_source,
    dispatch: dispatchLabel(quote),
    vat_rate: quote.vat_rate,
    quarantined: quote.quarantined,
  })

  return {
    /** Búsqueda acotada por texto/categoría con cotización vigente. */
    async searchCatalog({ query = '', category = '', onlyImmediateStock = false, limit = 10 } = {}) {
      const inputs = await repo.searchMasterProducts({ query, category, limit: Math.min(Math.max(limit, 1), 50) })
      const out = []
      for (const input of inputs) {
        const quote = computeQuote({ ...input, pricing_config: input.pricing_config || config.pricingConfig })
        if (quote.quarantined || quote.price_transfer == null) continue
        if (onlyImmediateStock && !(quote.stock > 0 && quote.stock_source === 'local')) continue
        out.push(compact(input, quote))
        if (out.length >= limit) break
      }
      return out
    },

    /** Ficha técnica + precios duales + tiempo de despacho. */
    async getProductSpecsAndQuote({ skuOrEan } = {}) {
      const input = await repo.findMasterBySkuOrEan(skuOrEan)
      if (!input) return { found: false, sku: skuOrEan }
      const quote = computeQuote({ ...input, pricing_config: input.pricing_config || config.pricingConfig })
      const m = input.master_product
      return {
        found: true,
        sku: m.sku,
        title: m.title,
        brand: m.brand,
        category: m.category,
        specs: m.staticData || {},
        price_transfer: quote.price_transfer,
        price_list: quote.price_list,
        stock: quote.stock,
        stock_source: quote.stock_source,
        active_supplier: quote.active_supplier,
        dispatch: dispatchLabel(quote),
        vat_rate: quote.vat_rate,
        quarantined: quote.quarantined,
        quarantine_reasons: quote.quarantine_reasons,
      }
    },

    /** Alias usado por el LLM para pedir sólo cotización vigente. */
    async getLiveQuote(args = {}) {
      return this.getProductSpecsAndQuote(args)
    },

    /**
     * Compatibilidad determinista: socket, DDR y watts de fuente.
     * Devuelve errores, advertencias y si hace falta intervención humana.
     */
    checkHardwareCompatibility({ items = [] } = {}) {
      const errors = []
      const warnings = []
      const get = (obj, keys) => {
        for (const k of keys) {
          const hit = Object.entries(obj || {}).find(([key]) => key.toLowerCase() === k.toLowerCase())
          if (hit && hit[1] != null && hit[1] !== '') return String(hit[1])
        }
        return null
      }
      const specsOf = item => item?.specs || item?.staticData || item?.static_data_json || {}
      const categoryOf = item => String(item?.category || '').toLowerCase()
      const ddrOf = s => {
        const raw = get(s, ['ddr', 'ram_type', 'tipo_ram', 'memoria', 'type'])
        const m = raw?.match(/ddr\s*(\d)/i)
        return m ? Number(m[1]) : null
      }
      const num = s => {
        const n = Number(String(s ?? '').replace(/[^\d.]/g, ''))
        return Number.isFinite(n) && n > 0 ? n : null
      }

      const cpu = items.find(i => categoryOf(i).includes('procesador') || get(specsOf(i), ['socket', 'zocalo', 'tdp']))
      const mobo = items.find(i => /mother|mobo|placa madre/.test(categoryOf(i)) || get(specsOf(i), ['chipset']))
      const rams = items.filter(i => categoryOf(i).includes('ram') || ddrOf(specsOf(i)))
      const gpus = items.filter(i => categoryOf(i).includes('gpu') || categoryOf(i).includes('video') || get(specsOf(i), ['vram']))
      const psu = items.find(i => /fuente|psu|power/.test(categoryOf(i)) || get(specsOf(i), ['watts', 'wattage']))

      const cpuSocket = get(specsOf(cpu), ['socket', 'zocalo', 'socket_cpu'])
      const mbSocket = get(specsOf(mobo), ['socket', 'zocalo', 'cpu_socket'])
      if (cpuSocket && mbSocket) {
        if (cpuSocket.toUpperCase() !== mbSocket.toUpperCase()) errors.push(`Socket ${cpuSocket} no coincide con motherboard ${mbSocket}`)
      } else warnings.push('No hay datos de socket para confirmar compatibilidad CPU/motherboard')

      const mbDdr = ddrOf(specsOf(mobo))
      for (const ram of rams) {
        const ddr = ddrOf(specsOf(ram))
        if (ddr && mbDdr && ddr !== mbDdr) errors.push(`RAM DDR${ddr} incompatible con motherboard DDR${mbDdr}`)
        else if (!ddr || !mbDdr) warnings.push('Falta tipo DDR para confirmar compatibilidad de memoria')
      }
      if (!rams.length) warnings.push('No se informó memoria RAM en la build')

      const cpuTdp = num(get(specsOf(cpu), ['tdp', 'consumo', 'watts'])) || 0
      const gpuTdp = gpus.reduce((s, g) => s + (num(get(specsOf(g), ['tdp', 'consumo', 'watts'])) || 0), 0)
      const estimated = 150 + cpuTdp + gpuTdp
      const psuWatts = num(get(specsOf(psu), ['watts', 'wattage', 'potencia']))
      if (psuWatts) {
        if (estimated > psuWatts) errors.push(`Consumo estimado ${estimated}W supera la fuente de ${psuWatts}W`)
      } else warnings.push('No se informó la potencia de la fuente')

      return {
        ok: errors.length === 0,
        errors,
        warnings,
        estimated_watts: estimated,
        needs_human: errors.length > 0 || warnings.length > 0,
      }
    },

    /** Link precargado: prohibido en el canal ml_question. */
    buildPreloadedCartUrl({ items = [], channel = 'web' } = {}) {
      if (channel === 'ml_question') return { allowed: false, reason: 'CANAL_NO_PERMITIDO' }
      const clean = items
        .map(i => ({ sku: String(i.sku || i.sku_interno || ''), qty: Math.max(1, Number(i.qty) || 1) }))
        .filter(i => i.sku)
      if (!clean.length) return { allowed: false, reason: 'SIN_ITEMS' }
      const cart = clean.map(i => `${encodeURIComponent(i.sku)}:${i.qty}`).join(',')
      return { allowed: true, url: `${baseUrl.replace(/\/$/, '')}/?cart=${encodeURIComponent(cart)}` }
    },
  }
}

export const TOOL_DEFINITIONS = [
  {
    name: 'searchCatalog',
    description: 'Busca productos reales del catálogo con precio y stock vigentes. Nunca inventes resultados.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        onlyImmediateStock: { type: 'boolean' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'getLiveQuote',
    description: 'Devuelve ficha técnica, precios duales y despacho de un SKU o EAN.',
    parameters: { type: 'object', properties: { skuOrEan: { type: 'string' } }, required: ['skuOrEan'] },
  },
  {
    name: 'checkCompatibility',
    description: 'Valida socket, DDR y consumo de fuente entre componentes.',
    parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } }, required: ['items'] },
  },
  {
    name: 'buildCartLink',
    description: 'Genera link al carrito precargado. No disponible para preguntas de Mercado Libre.',
    parameters: { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } }, required: ['items'] },
  },
]
