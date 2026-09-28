/**
 * Alta/actualización de iPhone en .mock-data.json + Firestore (categoría celulares).
 * Uso: node scripts/update-iphone-stock.mjs [--dry-run]
 * Precio: costo_usd * 1550 → + fijo tramo (50/80/100) * 1550 = transferencia; MP = transfer * 1.16
 * Variantes con precio distinto por color → SKU/color separado.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const USD_RATE = 1550
const MP_MARKUP = 0.16
const DRY = process.argv.includes('--dry-run')

// Listado de costo del proveedor (USD), con +U$S100 ya incluido (lista para reenviar).
// Precio distinto por color → variante con key propia.
const LIST = [
  // iPhone 18 Pro / Pro Max
  { key: 'IP18PRO-256', nombre: 'iPhone 18 Pro 256GB', usd: 1520, colores: 'Black, Glacier, Silver' },
  { key: 'IP18PRO-256-BURG', nombre: 'iPhone 18 Pro 256GB Burgundy', usd: 1570, colores: 'Burgundy' },
  { key: 'IP18PRO-512-SIL', nombre: 'iPhone 18 Pro 512GB Silver', usd: 1790, colores: 'Silver' },
  { key: 'IP18PRO-512', nombre: 'iPhone 18 Pro 512GB', usd: 1800, colores: 'Black, Glacier' },
  { key: 'IP18PRO-512-BURG', nombre: 'iPhone 18 Pro 512GB Burgundy', usd: 1820, colores: 'Burgundy' },
  { key: 'IP18PM-256', nombre: 'iPhone 18 Pro Max 256GB', usd: 1760, colores: 'Black' },
  { key: 'IP18PM-256-SG', nombre: 'iPhone 18 Pro Max 256GB Silver/Glacier', usd: 1770, colores: 'Silver, Glacier' },
  { key: 'IP18PM-256-BURG', nombre: 'iPhone 18 Pro Max 256GB Burgundy', usd: 1860, colores: 'Burgundy' },
  { key: 'IP18PM-512', nombre: 'iPhone 18 Pro Max 512GB', usd: 1960, colores: 'Black, Glacier, Silver' },
  { key: 'IP18PM-1TB', nombre: 'iPhone 18 Pro Max 1TB', usd: 2420, colores: 'Black' },
  { key: 'IP18PM-256-EU', nombre: 'iPhone 18 Pro Max 256GB Europeo', usd: 2020, colores: 'Black, Silver', nota: 'SIM + E-SIM' },
  // iPhone 17 Pro / Pro Max
  { key: 'IP17PRO-256', nombre: 'iPhone 17 Pro 256GB', usd: 1275, colores: 'Orange, Blue' },
  { key: 'IP17PRO-256-O', nombre: 'iPhone 17 Pro 256GB Orange', usd: 1280, colores: 'Orange' },
  { key: 'IP17PRO-256-SIL', nombre: 'iPhone 17 Pro 256GB Silver', usd: 1305, colores: 'Silver' },
  { key: 'IP17PRO-256-SIM', nombre: 'iPhone 17 Pro 256GB Orange SIM', usd: 1310, colores: 'Orange', nota: 'SIM' },
  { key: 'IP17PRO-512-O', nombre: 'iPhone 17 Pro 512GB Orange', usd: 1480, colores: 'Orange' },
  { key: 'IP17PRO-512-BLUE', nombre: 'iPhone 17 Pro 512GB Blue', usd: 1500, colores: 'Blue', nota: 'SIM + E-SIM' },
  { key: 'IP17PRO-512-SIL', nombre: 'iPhone 17 Pro 512GB Silver', usd: 1520, colores: 'Silver', nota: 'SIM + E-SIM' },
  { key: 'IP17PRO-1TB', nombre: 'iPhone 17 Pro 1TB', usd: 1680, colores: 'Orange, Silver, Blue' },
  { key: 'IP17PM-256', nombre: 'iPhone 17 Pro Max 256GB', usd: 1370, colores: 'Orange, Blue, Silver' },
  { key: 'IP17PM-512-O', nombre: 'iPhone 17 Pro Max 512GB Orange', usd: 1600, colores: 'Orange' },
  { key: 'IP17PM-512-BLUE', nombre: 'iPhone 17 Pro Max 512GB Blue', usd: 1610, colores: 'Blue' },
  { key: 'IP17PM-512-SIL', nombre: 'iPhone 17 Pro Max 512GB Silver', usd: 1650, colores: 'Silver' },
  { key: 'IP17PM-1TB-O', nombre: 'iPhone 17 Pro Max 1TB Orange', usd: 1690, colores: 'Orange' },
  { key: 'IP17PM-1TB', nombre: 'iPhone 17 Pro Max 1TB', usd: 1730, colores: 'Blue, Silver' },
  { key: 'IP17PM-2TB', nombre: 'iPhone 17 Pro Max 2TB', usd: 2050, colores: 'Orange' },
  // iPhone 17 / 17e / Air / 16 / 15
  { key: 'IP17-256-G', nombre: 'iPhone 17 256GB Green', usd: 1080, colores: 'Green' },
  { key: 'IP17-256', nombre: 'iPhone 17 256GB', usd: 1085, colores: 'Lavender, Sage, Blue, White, Black' },
  { key: 'IP17E-256', nombre: 'iPhone 17e 256GB', usd: 830, colores: 'Black, White, Pink' },
  { key: 'IP17E-512', nombre: 'iPhone 17e 512GB', usd: 1020, colores: 'Black' },
  { key: 'IP17AIR-256', nombre: 'iPhone 17 Air 256GB', usd: 1150, colores: 'Black, Blue', nota: 'E-SIM' },
  { key: 'IP16-128', nombre: 'iPhone 16 128GB', usd: 925, colores: 'Ultramarine, Pink, White, Teal, Black' },
  { key: 'IP15-128-B', nombre: 'iPhone 15 128GB Blue', usd: 805, colores: 'Blue' },
  { key: 'IP15-128-K', nombre: 'iPhone 15 128GB Black', usd: 840, colores: 'Black' },
  { key: 'IP15-128', nombre: 'iPhone 15 128GB', usd: 850, colores: 'Blue, Pink' },
]

function fixedUsd(usd) {
  if (usd < 250) return 50
  if (usd <= 400) return 80
  return 100
}

function priceFor(usd) {
  const costo = Math.round(usd * USD_RATE)
  const fx = fixedUsd(usd)
  const transferencia = Math.round(costo + fx * USD_RATE)
  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))
  return { costo, fx, transferencia, mercadopago }
}

function skuFor(key) {
  const h = createHash('sha256').update('APPLE-' + key).digest('hex').slice(0, 6).toUpperCase()
  return `IPH-${key}-${h}`
}

function buildDesired() {
  return LIST.map(item => {
    const { costo, fx, transferencia, mercadopago } = priceFor(item.usd)
    return {
      key: item.key,
      sku: skuFor(item.key),
      nombre: item.nombre,
      descripcion: `${item.nombre}. Colores: ${item.colores}.${item.nota ? ' ' + item.nota + '.' : ''} Stock del proveedor actualizado.`,
      usd: item.usd,
      costo,
      fx,
      transferencia,
      mercadopago,
      colores: item.colores,
      nota: item.nota || null,
    }
  })
}

function applyToProduct(p, d) {
  const esp = {
    ...(p.especificaciones && typeof p.especificaciones === 'object' ? p.especificaciones : {}),
    _costo_original: d.costo,
    _usd: d.usd,
    _usd_rate: USD_RATE,
    _pricing: { costo: d.costo, transferencia: d.transferencia, mercadopago: d.mercadopago, usdRate: USD_RATE, fixedUsd: d.fx },
    _colores: d.colores,
    ...(d.nota ? { _nota_precio: d.nota } : {}),
  }
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
    categoria: 'celulares',
    category: 'celulares',
    tipo_venta: 'directa',
    stock: p.stock ?? 1,
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

function newProduct(d, id) {
  const esp = {
    _costo_original: d.costo,
    _usd: d.usd,
    _usd_rate: USD_RATE,
    _pricing: { costo: d.costo, transferencia: d.transferencia, mercadopago: d.mercadopago, usdRate: USD_RATE, fixedUsd: d.fx },
    _colores: d.colores,
    ...(d.nota ? { _nota_precio: d.nota } : {}),
  }
  const imagenes = ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?q=80&w=800&auto=format&fit=crop']
  return {
    id,
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
    categoria: 'celulares',
    category: 'celulares',
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
    emoji: '\u{1F4F1}',
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

function randomId() {
  return createHash('md5').update(String(Math.random()) + Date.now()).digest('hex').slice(0, 12)
}

function isIphone(p) {
  return p.categoria === 'celulares' && (/iphone/i.test(String(p.nombre || '')) || String(p.marca || '').toLowerCase() === 'apple')
}

async function main() {
  const desired = buildDesired()
  console.log(`[iphone] Catálogo nuevo: ${desired.length} modelos (dry=${DRY})`)

  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const existing = (mock.products || []).filter(isIphone)
  console.log(`[iphone] Existentes en mock: ${existing.length}`)

  const desiredBySku = new Map(desired.map(d => [d.sku, d]))
  const desiredSkus = new Set(desired.map(d => d.sku))
  const usedDesired = new Set()
  const updates = []
  const unmapped = []

  for (const ex of existing) {
    const sku = String(ex.sku || '').toUpperCase()
    if (desiredBySku.has(sku)) {
      updates.push({ existing: ex, desired: desiredBySku.get(sku) })
      usedDesired.add(sku)
      continue
    }
    unmapped.push(ex)
  }
  const news = desired.filter(d => !usedDesired.has(d.sku))

  console.log(`[iphone] Updates: ${updates.length} | Altas: ${news.length} | Bajas: ${unmapped.length}`)
  for (const u of updates) {
    const delta = u.desired.transferencia - (u.existing.precio_transferencia || 0)
    console.log(`  ~ ${u.existing.sku} | ${u.desired.nombre} | usd ${u.desired.usd} | ${u.existing.precio_transferencia} → ${u.desired.transferencia} (${delta >= 0 ? '+' : ''}${delta})`)
  }
  for (const n of news) console.log(`  + ${n.sku} | ${n.nombre} | usd ${n.usd} | transfer ${n.transferencia}`)
  for (const b of unmapped) console.log(`  - ${b.sku} | ${b.nombre}`)

  if (DRY) {
    console.log('[iphone] dry-run: no se escribió nada')
    return
  }

  // --- Mock ---
  const removeIds = new Set(unmapped.map(p => String(p.id)))
  const byId = new Map(mock.products.map(p => [String(p.id), p]))
  for (const u of updates) byId.set(String(u.existing.id), applyToProduct(u.existing, u.desired))
  const created = []
  for (const n of news) {
    const id = randomId()
    const p = newProduct(n, id)
    byId.set(id, p)
    created.push(p)
  }
  const newProducts = []
  const seen = new Set()
  for (const p of mock.products) {
    const id = String(p.id)
    if (removeIds.has(id)) continue
    newProducts.push(byId.get(id) || p)
    seen.add(id)
  }
  for (const p of created) {
    if (!seen.has(String(p.id))) { newProducts.push(p); seen.add(String(p.id)) }
  }
  mock.products = newProducts
  fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
  const iphoneCount = mock.products.filter(isIphone).length
  console.log(`[iphone] Mock: total ${mock.products.length}, iphone ${iphoneCount}`)

  // --- Firestore ---
  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  const db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)

  const snap = await col.get()
  const bySku = new Map()
  for (const d of snap.docs) {
    const sku = String(d.data().sku || '').toUpperCase()
    if (sku) bySku.set(sku, { ref: d.ref, data: d.data() })
  }

  const now = new Date().toISOString()
  let wUpdates = 0, wCreates = 0, wDeletes = 0

  for (const d of desired) {
    const hit = bySku.get(d.sku.toUpperCase())
    if (hit) {
      const product = applyToProduct({ ...hit.data, id: hit.ref.id, sku: hit.data.sku || d.sku }, d)
      const { id: _drop, ...doc } = product
      await hit.ref.set({ ...doc, updatedAt: now }, { merge: true })
      wUpdates++
    } else {
      const product = newProduct(d, randomId())
      const { id, ...doc } = product
      await col.doc(d.sku).set({ ...doc, createdAt: now, updatedAt: now })
      wCreates++
    }
  }

  for (const [sku, entry] of bySku) {
    const data = entry.data
    if (!isIphone(data)) continue
    if (desiredSkus.has(sku)) continue
    await entry.ref.delete()
    wDeletes++
    console.log(`  firestore delete: ${sku} | ${data.nombre}`)
  }

  console.log(`[iphone] Firestore: ${wUpdates} updates, ${wCreates} creates, ${wDeletes} deletes`)
}

main().catch(e => {
  console.error('[iphone] Fatal:', e)
  process.exit(1)
})
