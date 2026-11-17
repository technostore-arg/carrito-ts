/**
 * server/hub/elitService.js — Cliente B2B de la API de Elit.
 *
 * Modos:
 *  - 'sandbox': usa fixtures locales si no hay base URL configurada.
 *  - 'production': llama a la API real con user_id + token (Bearer/Basic).
 *
 * Variables de entorno:
 *  ELIT_MODE=sandbox|production
 *  ELIT_USER_ID, ELIT_TOKEN
 *  ELIT_API_BASE_SANDBOX, ELIT_API_BASE_PRODUCTION
 *  ELIT_CATALOG_PATH, ELIT_STOCK_PATH (paths, default /productos y /stock)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_CATALOG = path.join(__dirname, 'fixtures', 'elit-catalog.json')
const FIXTURE_STOCK = path.join(__dirname, 'fixtures', 'elit-stock-prices.json')

export class ElitApiError extends Error {
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'ElitApiError'
    this.status = status
    this.payload = payload
  }
}

/**
 * Normaliza un item de Elit (catalogo o stock) al formato interno.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeElitItem(raw = {}) {
  const precio = raw.precio_usd ?? raw.precio ?? raw.costo ?? raw.price ?? 0
  const currency = String(raw.moneda || raw.currency || (raw.precio_usd != null ? 'USD' : 'ARS')).toUpperCase()
  return {
    supplierSku: String(raw.codigo || raw.sku || raw.codigo_proveedor || '').trim(),
    ean: raw.ean ? String(raw.ean).trim() : null,
    mpn: raw.mpn ? String(raw.mpn).trim() : null,
    title: String(raw.descripcion || raw.nombre || raw.title || '').trim(),
    brand: String(raw.marca || raw.brand || 'Genérica').trim(),
    category: String(raw.categoria || raw.category || 'accesorios').toLowerCase().trim(),
    costAmount: Number(precio) || 0,
    costCurrency: ['USD', 'ARS'].includes(currency) ? currency : 'USD',
    rawStock: Math.max(0, Math.floor(Number(raw.stock ?? raw.stock_actual) || 0)),
    imageUrl: raw.imagen_url || raw.imagen || raw.image_url || null,
    raw,
  }
}

/** @param {object} payload @param {string} key */
function extractItems(payload, key) {
  if (Array.isArray(payload)) return payload
  const data = payload?.data ?? payload
  if (Array.isArray(data?.[key])) return data[key]
  if (Array.isArray(data?.productos)) return data.productos
  if (Array.isArray(data?.actualizaciones)) return data.actualizaciones
  if (Array.isArray(data?.items)) return data.items
  return []
}

/** Reintenta sólo errores transitorios (red / 5xx / 429). */
async function requestWithRetry(url, options, { attempts = 2, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const err = new ElitApiError(`Elit respondió ${res.status}`, res.status, text.slice(0, 500))
        if (res.status < 500 && res.status !== 429) throw err
        last = err
        continue
      }
      return await res.json()
    } catch (e) {
      if (e instanceof ElitApiError && e.status < 500 && e.status !== 429) throw e
      last = e
    }
  }
  throw last instanceof Error ? last : new ElitApiError('Error de red con Elit', 0)
}

/**
 * @param {object} opts
 * @returns {{mode:string, getCatalog:Function, getStockAndPrices:Function}}
 */
export function createElitClient(opts = {}) {
  const mode = opts.mode || process.env.ELIT_MODE || 'sandbox'
  const userId = opts.userId || process.env.ELIT_USER_ID || ''
  const token = opts.token || process.env.ELIT_TOKEN || ''
  const baseUrl = opts.baseUrl || process.env[mode === 'production' ? 'ELIT_API_BASE_PRODUCTION' : 'ELIT_API_BASE_SANDBOX'] || ''
  const catalogPath = opts.catalogPath || process.env.ELIT_CATALOG_PATH || '/productos'
  const stockPath = opts.stockPath || process.env.ELIT_STOCK_PATH || '/stock'

  // Sin base URL (o sandbox explícito sin credenciales) => fixtures locales.
  const useFixture = !!opts.useFixture || (!baseUrl && (mode !== 'production' || !token))

  if (useFixture) return createFixtureClient(opts)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-User-Id': userId,
  }

  return {
    mode,
    async getCatalog({ page = 1, pageSize = 100 } = {}) {
      const url = `${baseUrl.replace(/\/$/, '')}${catalogPath}?page=${page}&pageSize=${pageSize}`
      const payload = await requestWithRetry(url, { headers }, opts)
      return extractItems(payload, 'productos').map(normalizeElitItem)
    },
    async getStockAndPrices({ since } = {}) {
      const q = since ? `?desde=${encodeURIComponent(since)}` : ''
      const url = `${baseUrl.replace(/\/$/, '')}${stockPath}${q}`
      const payload = await requestWithRetry(url, { headers }, opts)
      return extractItems(payload, 'actualizaciones').map(normalizeElitItem)
    },
    async placeOrder({ items = [], sandbox = mode !== 'production' } = {}) {
      const url = `${baseUrl.replace(/\/$/, '')}${opts.orderPath || process.env.ELIT_ORDER_PATH || '/pedidos'}`
      return requestWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items, sandbox }),
      }, opts)
    },
  }
}

/** Cliente fixture para tests y desarrollo sin credenciales. */
export function createFixtureClient(opts = {}) {
  const catalogFile = opts.catalogFile || FIXTURE_CATALOG
  const stockFile = opts.stockFile || FIXTURE_STOCK
  return {
    mode: 'fixture',
    async getCatalog() {
      const payload = JSON.parse(fs.readFileSync(catalogFile, 'utf8'))
      return extractItems(payload, 'productos').map(normalizeElitItem)
    },
    async getStockAndPrices() {
      const payload = JSON.parse(fs.readFileSync(stockFile, 'utf8'))
      return extractItems(payload, 'actualizaciones').map(normalizeElitItem)
    },
    async placeOrder({ items = [] } = {}) {
      return { order_id: `ELIT-FIXTURE-${Date.now()}`, status: 'confirmed', sandbox: true, items }
    },
  }
}
