/**
 * server/hub/elitService.js — Cliente real de la API de Elit (manual MANUAL_API_CLIENTES).
 *
 * Base: https://clientes.elit.com.ar/v1/api
 * Auth: user_id + token en el body (POST) o en la URL (GET/DELETE).
 * Catálogo: POST /productos con paginación limit/offset. Respuesta OK trae "codigo": 200.
 * Pedido a proveedor: POST /carrito (items) y POST /carrito/confirmar.
 *
 * Modo fixture (sandbox): sin credenciales usa fixtures locales con el shape real.
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

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Mapea la categoría de Elit al slug interno del hub. */
function mapElitCategory(raw = {}) {
  const name = `${raw.categoria ?? ''} ${raw.sub_categoria ?? ''}`.toLowerCase()
  if (/notebook|laptop|macbook/.test(name)) return 'notebooks'
  if (/placa de video|tarjeta gráfica|tarjeta de video|\bgpu\b/.test(name)) return 'gpus'
  if (/memoria ram/.test(name)) return 'ram'
  if (/ssd|nvme|disco|almacen/.test(name)) return 'almacenamiento'
  if (/procesador|\bcpu\b/.test(name)) return 'procesadores'
  if (/mother|placa madre/.test(name)) return 'motherboard'
  if (/monitor/.test(name)) return 'monitores'
  if (/celular|smartphone/.test(name)) return 'celulares'
  if (/computadora|all in one|aio/.test(name)) return 'computadoras'
  return slug(raw.categoria) || 'accesorios'
}

/** Campos reales del manual -> shape interno del hub. */
export function normalizeElitItem(raw = {}) {
  const images = Array.isArray(raw.imagenes) ? raw.imagenes : (raw.uri ? [raw.uri] : [])
  const attrs = raw.atributos && typeof raw.atributos === 'object' ? raw.atributos : {}
  const iva = Number(raw.iva)
  return {
    supplierSku: String(raw.codigo_alfa ?? raw.codigo_producto ?? raw.id ?? '').trim(),
    ean: raw.ean ? String(raw.ean).trim() : null,
    mpn: raw.codigo_producto ? String(raw.codigo_producto).trim() : null,
    title: String(raw.nombre ?? '').trim(),
    brand: String(raw.marca ?? 'Genérica').trim(),
    category: mapElitCategory(raw),
    subcategory: String(raw.sub_categoria ?? '').trim(),
    // "precio" es la base sin markup (USD); pvp_* es el sugerido con markup.
    costAmount: Number(raw.precio) || 0,
    costCurrency: 'USD',
    costArs: Number(raw.pvp_ars) || 0,
    listPriceArs: Number(raw.pvp_ars) || 0,
    listPriceUsd: Number(raw.pvp_usd) || 0,
    vatRate: Number.isFinite(iva) && iva > 0 ? iva / 100 : null,
    markup: Number(raw.markup) || 0,
    exchangeRate: Number(raw.cotizacion) || null,
    rawStock: Math.max(0, Math.floor(Number(raw.stock_total ?? 0) || 0)),
    stockByWarehouse: {
      cd: Number(raw.stock_deposito_cd) || 0,
      cliente: Number(raw.stock_deposito_cliente) || 0,
    },
    stockLevel: String(raw.nivel_stock ?? '').toLowerCase() || null,
    warranty: raw.garantia ?? null,
    imageUrl: images[0] || raw.uri || null,
    images,
    attributes: attrs,
    description: String(raw.descripcion ?? '').trim(),
    link: raw.link ?? null,
    weightKg: Number(raw.peso) || null,
    updatedAt: raw.actualizado_iso ?? raw.actualizado ?? null,
    raw,
  }
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  const data = payload?.data ?? payload
  if (Array.isArray(data)) return data
  for (const key of ['productos', 'resultado', 'items', 'products', 'results', 'result']) {
    const v = data?.[key]
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      for (const inner of ['productos', 'items', 'results', 'lista', 'datos']) {
        if (Array.isArray(v[inner])) return v[inner]
      }
    }
  }
  return []
}

/** Reintenta sólo errores transitorios (red / 5xx / 429). */
async function requestWithRetry(url, options, { attempts = 2, timeoutMs = 15000, fetchImpl = fetch } = {}) {
  let last
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
      const text = await res.text().catch(() => '')
      let data = null
      try { data = JSON.parse(text) } catch { /* texto plano */ }
      if (!res.ok) {
        const err = new ElitApiError(`Elit respondió ${res.status}`, res.status, data || text)
        if (res.status < 500 && res.status !== 429) throw err
        last = err
        continue
      }
      return data
    } catch (e) {
      if (e instanceof ElitApiError && e.status < 500 && e.status !== 429) throw e
      last = e
    }
  }
  throw last instanceof Error ? last : new ElitApiError('Error de red con Elit', 0)
}

/**
 * @param {object} opts
 * @returns {{mode:string, getCatalog:Function, getStockAndPrices:Function, placeOrder:Function, getShipping:Function}}
 */
export function createElitClient(opts = {}) {
  const mode = opts.mode || process.env.ELIT_MODE || 'sandbox'
  const userId = opts.userId || process.env.ELIT_USER_ID || ''
  const token = opts.token || process.env.ELIT_TOKEN || ''
  const baseUrl = (opts.baseUrl || process.env.ELIT_BASE_URL || 'https://clientes.elit.com.ar/v1/api').replace(/\/$/, '')
  const fetchImpl = opts.fetchImpl || fetch

  const useFixture = !!opts.useFixture || (!userId || !token)
  if (useFixture) return createFixtureClient(opts)

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const creds = { user_id: userId, token }
  let lastCall = { mode: 'production', path: null, ok: false, codigo: null, keys: [], items: 0, sample: null }

  async function post(path, body) {
    const data = await requestWithRetry(`${baseUrl}${path}`, {
      method: 'POST', headers, body: JSON.stringify({ ...creds, ...(body || {}) }),
    }, opts)
    const items = extractItems(data)
    lastCall = {
      mode: 'production', path, ok: true,
      codigo: data?.codigo ?? data?.code ?? null,
      keys: Object.keys(data || {}),
      items: items.length,
      sample: items[0] ? Object.keys(items[0]) : null,
      firstItemPreview: items[0] ? JSON.stringify(items[0]).slice(0, 500) : null,
      paginador: data?.paginador ?? null,
    }
    return data
  }

  /** Pagina POST /productos hasta agotar (tope 5000 ítems). */
  async function listProducts(extra = {}) {
    let out = []
    let offset = 0
    const pageSize = 100
    while (out.length < 5000) {
      const payload = await post('/productos', { limit: pageSize, offset, ...extra })
      const items = extractItems(payload)
      if (!items.length) break
      out = out.concat(items)
      if (items.length < pageSize) break
      offset += pageSize
    }
    return out.map(normalizeElitItem)
  }

  return {
    mode,
    get lastCall() { return lastCall },
    async getCatalog({ pageSize = 100 } = {}) { return listProducts() },
    async getStockAndPrices({ since } = {}) {
      return listProducts(since ? { actualizacion: since } : {})
    },
    async getShipping() { return post('/envios', {}) },
    async placeOrder({ items = [] } = {}) {
      for (const it of items) {
        await post('/carrito', {
          code: it.sku, quantity: Math.max(1, Number(it.qty) || 1),
          ...(it.warehouse ? { warehouse: it.warehouse } : {}),
        })
      }
      return post('/carrito/confirmar', {})
    },
  }
}

/** Cliente fixture con el shape real de la API, para tests y desarrollo sin credenciales. */
export function createFixtureClient(opts = {}) {
  const catalogFile = opts.catalogFile || FIXTURE_CATALOG
  const stockFile = opts.stockFile || FIXTURE_STOCK
  const read = f => extractItems(JSON.parse(fs.readFileSync(f, 'utf8')))
  return {
    mode: 'fixture',
    async getCatalog() { return read(catalogFile).map(normalizeElitItem) },
    async getStockAndPrices() { return read(stockFile).map(normalizeElitItem) },
    async placeOrder({ items = [] } = {}) { return { codigo: 200, notas: [{ id: `ELIT-FIXTURE-${Date.now()}`, items }] } },
    async getShipping() { return { codigo: 200, envios: [] } },
  }
}
