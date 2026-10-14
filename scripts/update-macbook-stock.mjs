/**
 * MacBook NUEVOS (Neo, Air, Pro, Mini) → mock + Firestore.
 * Uso: node scripts/update-macbook-stock.mjs [--dry-run]
 * Los US$ listados son el COSTO del equipo → venta = costo + ganancia, todo en pesos:
 *   ganancia: U$S 100 si costo ≤ 1500 · U$S 200 si costo > 1500
 *   precio (costo interno)      = usd × 1550
 *   precio_transferencia (venta) = (usd + ganancia) × 1550
 *   precio_mercadopago          = transferencia × 1.16  (recargo por medio de pago)
 * SKU por variante exacta (línea + tamaño + CPU + RAM + disco + color [+ teclado/GPU]).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const USD_RATE = 1550
const MP_MARKUP = 0.16
const DRY = process.argv.includes('--dry-run')

// { m: key SKU, linea, size, cpu, ram, stor, usd, colors, teclado?, gpu? }
const LIST = [
  { m: 'NEO', linea: 'Neo', size: '13', cpu: null, ram: 8, stor: '256', usd: 830, colors: ['Silver', 'Citrus', 'Indigo'] },
  { m: 'NEO', linea: 'Neo', size: '13', cpu: null, ram: 8, stor: '256', usd: 850, colors: ['Blush'] },
  { m: 'NEO', linea: 'Neo', size: '13', cpu: null, ram: 8, stor: '512', usd: 950, colors: ['Silver', 'Citrus', 'Indigo', 'Blush'] },
  { m: 'AIR', linea: 'Air', size: '13', cpu: 'M5', ram: 16, stor: '512', usd: 1390, colors: ['Midnight', 'Starlight', 'Silver', 'Sky Blue'] },
  { m: 'AIR', linea: 'Air', size: '13', cpu: 'M5', ram: 16, stor: '1T', usd: 1650, colors: ['Midnight', 'Sky Blue'] },
  { m: 'AIR', linea: 'Air', size: '13', cpu: 'M5', ram: 24, stor: '1T', usd: 1880, colors: ['Midnight', 'Sky Blue'] },
  { m: 'AIR', linea: 'Air', size: '13', cpu: 'M5', ram: 24, stor: '1T', usd: 2005, colors: ['Starlight'] },
  { m: 'AIR', linea: 'Air', size: '15', cpu: 'M5', ram: 16, stor: '512', usd: 1590, colors: ['Midnight'] },
  { m: 'AIR', linea: 'Air', size: '15', cpu: 'M5', ram: 16, stor: '512', usd: 1600, colors: ['Starlight', 'Sky Blue'] },
  { m: 'AIR', linea: 'Air', size: '15', cpu: 'M5', ram: 16, stor: '1T', usd: 1830, colors: ['Midnight'] },
  { m: 'AIR', linea: 'Air', size: '15', cpu: 'M5', ram: 16, stor: '1T', usd: 1905, colors: ['Starlight'] },
  { m: 'AIR', linea: 'Air', size: '15', cpu: 'M5', ram: 24, stor: '1T', usd: 2130, colors: ['Midnight', 'Sky Blue'] },
  // sin colores explícitos en la lista → se asumen los 2 estándar del modelo
  { m: 'P14', linea: 'Pro 14', size: '14', cpu: 'M5', ram: 16, stor: '512', usd: 1960, colors: ['Silver', 'Space Black'] },
  { m: 'P14', linea: 'Pro 14', size: '14', cpu: 'M5', ram: 16, stor: '1T', usd: 2090, colors: ['Silver'] },
  { m: 'P14', linea: 'Pro 14', size: '14', cpu: 'M5', ram: 16, stor: '1T', usd: 2110, colors: ['Space Black'] },
  { m: 'P14', linea: 'Pro 14', size: '14', cpu: 'M5', ram: 16, stor: '1T', usd: 2100, colors: ['Space Black', 'Silver'], teclado: 'Español' },
  { m: 'P14', linea: 'Pro 14', size: '14', cpu: 'M5', ram: 24, stor: '1T', usd: 2330, colors: ['Space Black'] },
  { m: 'P14PP', linea: 'Pro 14', size: '14', cpu: 'M5 Pro', ram: 24, stor: '1T', usd: 2550, colors: ['Space Black', 'Silver'] },
  { m: 'P14PP', linea: 'Pro 14', size: '14', cpu: 'M5 Pro', ram: 24, stor: '2T', usd: 3130, colors: ['Space Black'], gpu: '18 CPU/20 GPU' },
  { m: 'P14PP', linea: 'Pro 14', size: '14', cpu: 'M5 Pro', ram: 24, stor: '2T', usd: 3145, colors: ['Space Black', 'Silver'] },
  { m: 'P16PP', linea: 'Pro 16', size: '16', cpu: 'M5 Pro', ram: 24, stor: '1T', usd: 2950, colors: ['Space Black', 'Silver'] },
  { m: 'P16PP', linea: 'Pro 16', size: '16', cpu: 'M5 Pro', ram: 48, stor: '1T', usd: 3710, colors: ['Space Black', 'Silver'] },
  { m: 'P16MX', linea: 'Pro 16', size: '16', cpu: 'M5 Max', ram: 36, stor: '2T', usd: 4430, colors: ['Space Black'] },
]

const COLOR_KEY = {
  Silver: 'SIL', 'Space Black': 'SBK', Midnight: 'MID', Starlight: 'STL',
  'Sky Blue': 'SKY', Citrus: 'CTR', Indigo: 'IND', Blush: 'BLS',
}

const GANANCIA_BAJA = 100
const GANANCIA_ALTA = 200
const GANANCIA_UMBRAL = 1500

function margenFor(usd) {
  return usd > GANANCIA_UMBRAL ? GANANCIA_ALTA : GANANCIA_BAJA
}

function priceFor(usdCosto) {
  const costo = Math.round(usdCosto * USD_RATE)
  const margen = margenFor(usdCosto)
  const transferencia = Math.round((usdCosto + margen) * USD_RATE)
  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))
  return { costo, margen, transferencia, mercadopago }
}

function storLabel(stor) {
  return stor.endsWith('T') ? stor : `${stor}GB`
}

function skuFor(item, color) {
  let sku = `MBKU-${item.m}-${item.size}-${item.ram}-${item.stor}-${COLOR_KEY[color]}`
  if (item.teclado) sku += '-ES'
  if (item.gpu) sku += '-18C20G'
  return sku
}

function buildDesired() {
  const out = []
  for (const item of LIST) {
    for (const color of item.colors) {
      const sku = skuFor(item, color)
      const { costo, margen, transferencia, mercadopago } = priceFor(item.usd)
      const cpuTxt = item.cpu ? ` ${item.cpu}` : ''
      const tecladoTxt = item.teclado ? ` · Teclado ${item.teclado}` : ''
      const gpuTxt = item.gpu ? ` · ${item.gpu}` : ''
      const nombre = `MacBook ${item.linea} ${item.size}"${cpuTxt} ${item.ram}GB/${storLabel(item.stor)} · ${color}${tecladoTxt}${gpuTxt}`
      out.push({
        sku, nombre, color, item,
        descripcion: `${nombre}. Equipo nuevo con garantía de fábrica. Stock del proveedor actualizado.`,
        usd: item.usd, costo, margen, transferencia, mercadopago,
      })
    }
  }
  return out
}

function especFor(d) {
  const it = d.item
  const esp = {
    _almacenamiento: storLabel(it.stor),
    _memoria: `${it.ram}GB`,
    _color: d.color,
    _modelo: `MacBook ${it.linea} ${it.size}"`,
    ...(it.cpu ? { _cpu: it.cpu } : {}),
    ...(it.teclado ? { _teclado: it.teclado } : {}),
    ...(it.gpu ? { _gpu: it.gpu } : {}),
    _usd_costo: d.usd,
    _usd_rate: USD_RATE,
    _pricing: {
      costo: d.costo,
      transferencia: d.transferencia,
      mercadopago: d.mercadopago,
      usdRate: USD_RATE,
      usdCosto: d.usd,
      margenUsd: d.margen,
      regla: 'ganancia U$S100 (costo ≤1500) / U$S200 (costo >1500); todo expresado en pesos',
    },
  }
  return esp
}

function applyToProduct(p, d) {
  const esp = { ...(p.especificaciones && typeof p.especificaciones === 'object' ? p.especificaciones : {}), ...especFor(d) }
  return {
    ...p,
    nombre: d.nombre,
    name: d.nombre,
    descripcion: d.descripcion,
    description: d.descripcion,
    precio: d.costo,
    price: d.costo,
    precio_transferencia: d.transferencia,
    precio_mercadopago: d.mercadopago,
    marca: 'apple',
    brand: 'apple',
    fabricante: 'Apple',
    categoria: 'notebooks',
    category: 'notebooks',
    tipo_venta: 'directa',
    stock: 1,
    estado: 'activo',
    active: true,
    fuente_origen: 'archivo_normalizado',
    moneda: 'ARS',
    sku: d.sku,
    especificaciones: esp,
    specs: Object.values(esp).filter(v => typeof v === 'string' || typeof v === 'number'),
    updatedAt: new Date().toISOString(),
  }
}

function newProduct(d) {
  const imagenes = ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=800&auto=format&fit=crop']
  const esp = especFor(d)
  return {
    id: `mb-${d.sku.toLowerCase()}`,
    sku: d.sku,
    nombre: d.nombre,
    name: d.nombre,
    descripcion: d.descripcion,
    description: d.descripcion,
    precio: d.costo,
    price: d.costo,
    precio_transferencia: d.transferencia,
    precio_mercadopago: d.mercadopago,
    marca: 'apple',
    brand: 'apple',
    fabricante: 'Apple',
    categoria: 'notebooks',
    category: 'notebooks',
    condicion: 'nuevo',
    tipo_venta: 'directa',
    stock: 1,
    estado: 'activo',
    active: true,
    fuente_origen: 'archivo_normalizado',
    moneda: 'ARS',
    imagenes,
    image: imagenes[0],
    especificaciones: esp,
    specs: Object.values(esp).filter(v => typeof v === 'string' || typeof v === 'number'),
    emoji: '\u{1F34E}',
    rating: 4.5,
    reviews: 0,
    vram: null,
    cuda: null,
    tflops: null,
    frameworks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function isMacbook(p) {
  return /macbook/i.test(String(p.nombre || ''))
}

async function main() {
  const desired = buildDesired()
  console.log(`[macbook] Catálogo: ${desired.length} SKUs (dry=${DRY})`)

  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const existing = (mock.products || []).filter(isMacbook)
  console.log(`[macbook] Existentes en mock: ${existing.length}`)

  const bySkuDesired = new Map(desired.map(d => [d.sku, d]))
  const desiredSkus = new Set(desired.map(d => d.sku))
  const updates = []
  const unmapped = []
  for (const ex of existing) {
    const hit = bySkuDesired.get(String(ex.sku || '').toUpperCase())
    if (hit) { updates.push({ existing: ex, desired: hit }); bySkuDesired.delete(String(ex.sku).toUpperCase()) }
    else unmapped.push(ex)
  }
  const news = [...bySkuDesired.values()]

  console.log(`[macbook] Updates: ${updates.length} | Altas: ${news.length} | Bajas: ${unmapped.length}`)
  for (const n of news) console.log(`  + ${n.sku} | ${n.nombre} | costo $${n.costo} → venta $${n.transferencia} (+U$S${n.margen})`)
  for (const b of unmapped) console.log(`  - ${b.sku} | ${b.nombre}`)

  if (DRY) {
    console.log('[macbook] dry-run: no se escribió nada')
    return
  }

  // --- Mock ---
  const removeIds = new Set(unmapped.map(p => String(p.id)))
  const byId = new Map(mock.products.map(p => [String(p.id), p]))
  for (const u of updates) byId.set(String(u.existing.id), applyToProduct(u.existing, u.desired))
  const created = []
  for (const n of news) {
    const p = newProduct(n)
    byId.set(p.id, p)
    created.push(p)
  }
  const out = []
  const seen = new Set()
  for (const p of mock.products) {
    const id = String(p.id)
    if (removeIds.has(id)) continue
    out.push(byId.get(id) || p)
    seen.add(id)
  }
  for (const p of created) {
    if (!seen.has(String(p.id))) { out.push(p); seen.add(String(p.id)) }
  }
  mock.products = out
  fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
  const macCount = mock.products.filter(isMacbook).length
  console.log(`[macbook] Mock: total ${mock.products.length}, macbooks ${macCount}`)

  // --- Firestore ---
  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  const db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)
  const snap = await col.get()
  const fsBySku = new Map()
  for (const d of snap.docs) {
    const sku = String(d.data().sku || '').toUpperCase()
    if (sku) fsBySku.set(sku, { ref: d.ref, data: d.data() })
  }

  const now = new Date().toISOString()
  let wUpdates = 0, wCreates = 0, wDeletes = 0
  for (const d of desired) {
    const hit = fsBySku.get(d.sku.toUpperCase())
    if (hit) {
      const product = applyToProduct({ ...hit.data, id: hit.ref.id, sku: hit.data.sku || d.sku }, d)
      const { id: _drop, ...doc } = product
      await hit.ref.set({ ...doc, updatedAt: now }, { merge: true })
      wUpdates++
    } else {
      const product = newProduct(d)
      const { id, ...doc } = product
      await col.doc(d.sku).set({ ...doc, createdAt: now, updatedAt: now })
      wCreates++
    }
  }
  for (const [sku, entry] of fsBySku) {
    const data = entry.data
    if (!isMacbook(data)) continue
    if (desiredSkus.has(sku)) continue
    await entry.ref.delete()
    wDeletes++
    console.log(`  firestore delete: ${sku} | ${data.nombre}`)
  }
  console.log(`[macbook] Firestore: ${wUpdates} updates, ${wCreates} creates, ${wDeletes} deletes`)
}

main().catch(e => {
  console.error('[macbook] Fatal:', e)
  process.exit(1)
})
