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

/** Categoría de Elit tal cual (normalizada a slug) — sin heurísticos por nombre de producto. */
function mapElitCategory(raw = {}) {
  return slug(raw.categoria) || 'tecnologia'
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
    categoryRaw: String(raw.categoria ?? '').trim(),
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

/** Transforma una fila de CSV de Meta/Tienda Nube/WooCommerce a shape del hub. */
function parseCsvLine(line) {
  const out = []
  let i = 0
  while (i < line.length) {
    let field = ''
    if (line[i] === '"') {
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { field += line[i]; i++ }
      }
    } else {
      const start = i
      while (i < line.length && line[i] !== ',' && line[i] !== '\n') { field += line[i]; i++ }
      if (line[i] === '\n') break
    }
    out.push(field)
    if (line[i] === ',') i++
    else break
  }
  return out
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => {
    const t = l.trim()
    // Elit devuelve `sep=,` como primera línea (formato Excel): no es cabecera.
    return t !== '' && !/^sep\s*=/i.test(t)
  })
  if (!lines.length) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  return lines.slice(1).map(l => {
    const row = parseCsvLine(l)
    const o = {}
    for (let i = 0; i < header.length; i++) o[header[i]] = row[i] ?? ''
    return o
  })
}

function firstDefined(row, keys) {
  for (const k of keys) if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim()
  return null
}

/** Mapea CSV de plataformas de Meta a slugs internos del hub. */
function mapCsvCategory(raw) {
  return mapElitCategory({ nombre: `${raw} ${''}`, categoria: raw })
}

function normalizeCsvRow(row) {
  const weight = Number(firstDefined(row, ['Peso (kg)', 'peso', 'weight', 'weight_kg']))
  const imageUrl = firstDefined(row, ['Imagen', 'imagen', 'link', 'uri', 'image_link', 'uri_producto'])
  return {
    supplierSku: firstDefined(row, ['SKU', 'sku', 'codigo_alfa', 'codigo_producto', 'code', 'id']),
    ean: firstDefined(row, ['ean', 'code_bar', 'barcode']),
    title: firstDefined(row, ['Nombre', 'nombre', 'name', 'product_name']),
    brand: firstDefined(row, ['Marca', 'marca', 'brand']),
    category: mapCsvCategory(firstDefined(row, ['Categorías', 'categoría', 'categoria', 'category', 'Categorias']) || ''),
    categoryRaw: String(firstDefined(row, ['Categorías', 'categoría', 'categoria', 'category', 'Categorias']) || '').trim(),
    subcategory: firstDefined(row, ['Subcategoría', 'subcategoría', 'subcategoria', 'sub_categoria']),
    vatRate: (() => {
      const v = Number(firstDefined(row, ['iva', 'IVA']))
      if (!Number.isFinite(v) || v <= 0) return null
      return v < 1 ? v : (v <= 100 ? v / 100 : null)
    })(),
    costAmount: Number(firstDefined(row, ['Precio', 'precio', 'pvp_usd', 'price', 'price_usd']) || 0),
    costCurrency: 'USD',
    rawStock: Math.max(0, Math.floor(Number(firstDefined(row, ['Stock', 'stock_total', 'stock', 'cantidad']) || 0))),
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    attributes: {},
    weightKg: Number.isFinite(weight) && weight > 0 ? weight : null,
  }
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
  let lastCall = { mode: 'production', path: null, ok: false, codigo: null, keys: [], items: 0, sample: null, firstItemPreview: null, paginador: null, pages: [] }
  let debugPages = []
  let lastCsv = null

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
      pages: debugPages,
    }
    return data
  }

  /** Catálogo COMPLETO usando el CSV que devuelve Elit (sin paginado problemático). */
  async function fetchCatalogCsv() {
    let res
    try {
      res = await fetchImpl(`${baseUrl}/productos/csv?${new URLSearchParams(creds)}`, {
        method: 'GET', headers: { Accept: 'text/csv, application/json' },
      })
    } catch (e) {
      lastCall = { mode: 'production', path: '/productos/csv', ok: false, error: e.message, items: 0 }
      return []
    }
    const text = await res.text().catch(() => '')
    lastCsv = {
      ok: res.ok,
      status: res.status,
      path: '/productos/csv',
      chars: text.length,
      firstPreview: text.slice(0, 500),
    }
    if (!res.ok) return []
    const rows = parseCsv(text)
    lastCsv.rows = rows.length
    return rows
  }

  /** Pagina POST /productos (fallback cuando no hay CSV). */
  async function listProducts(extra = {}) {
    let out = []
    const seen = new Set()
    const pages = []
    debugPages = pages
    let offset = 0
    const pageSize = 40
    const maxItems = 5000
    let stalled = false
    while (out.length < maxItems) {
      const payload = await post('/productos', { limit: pageSize, offset, ...extra })
      const raw = extractItems(payload)
      const items = raw.filter(x => !seen.has(x.codigo_alfa))
      const total = Number(payload?.paginador?.total)
      const limit = Number(payload?.paginador?.limit) || pageSize
      pages.push({ offset, requested: raw.length, newItems: items.length, total, limit })
      if (!items.length) {
        // Si ya tenemos items y Elit no devolvió nuevos en esta página,
        // el offset no avanza: marcamos estancamiento para el brute force.
        stalled = out.length > 0 && offset > 0
        break
      }
      for (const x of items) seen.add(x.codigo_alfa)
      out = out.concat(items)
      const ended = (Number.isFinite(total) && out.length >= total)
        || (raw.length < limit)
      if (ended) break
      offset += raw.length
    }
    if (stalled) {
      // Fallback brute: probamos limit=1838 (el total de paginador) en offset 0.
      const payload = await post('/productos', { limit: 1838, offset: 0, ...extra }).catch(() => null)
      const raw2 = extractItems(payload)
      const brute = raw2.filter(x => !seen.has(x.codigo_alfa))
      pages.push({ brute: true, offset: 0, requested: raw2.length, newItems: brute.length, total: Number(payload?.paginador?.total) })
      if (brute.length) {
        for (const x of brute) seen.add(x.codigo_alfa)
        out = out.concat(brute)
      }
    }
    return out.map(normalizeElitItem)
  }

  return {
    mode,
    get lastCall() { return lastCall },
    get lastCsv() { return lastCsv },
    async getCatalog({ pageSize = 100 } = {}) {
      const csvRows = await fetchCatalogCsv()
      const fromCsv = csvRows.map(normalizeCsvRow).filter(i => i.supplierSku)
      if (fromCsv.length >= 10) return fromCsv
      return listProducts()
    },
    async getStockAndPrices({ since } = {}) {
      const csvRows = await fetchCatalogCsv()
      const fromCsv = csvRows.map(normalizeCsvRow).filter(i => i.supplierSku)
      if (fromCsv.length >= 10) return fromCsv
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
