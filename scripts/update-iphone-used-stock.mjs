/**
 * iPhone USADOS (condición: usado, garantía 30 días) → mock + Firestore.
 * Uso: node scripts/update-iphone-used-stock.mjs [--dry-run]
 * Los US$ listados son PRECIO DE VENTA FINAL (transferencia):
 *   precio_transferencia = usd × 1550
 *   precio_mercadopago   = transferencia × 1.16
 *   precio (costo interno, estimado) = transferencia × 0.85 → solo para métricas de margen
 * SKU por variante exacta (modelo + almacenamiento + calidad + batería + color).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const USD_RATE = 1550
const MP_MARKUP = 0.16
const COST_FACTOR = 0.85
const DRY = process.argv.includes('--dry-run')

// [modelo, almacenamiento GB, calidad, batería %, color, usd_venta, stock]
const LIST = [
  // --- SERIE IPHONE 13 ---
  ['iPhone 13', 128, 'A', 100, 'Black', 435, 1],
  ['iPhone 13', 128, 'A', 100, 'Black', 420, 1],
  ['iPhone 13', 128, 'A', 87, 'Black', 405, 1],
  ['iPhone 13', 128, 'A', 85, 'Black', 405, 1],
  ['iPhone 13', 128, 'A-', 100, 'Black', 420, 3],
  ['iPhone 13', 128, 'A-', 97, 'Black', 405, 1],
  ['iPhone 13', 128, 'A-', 88, 'Black', 405, 1],
  ['iPhone 13', 128, 'A-', 87, 'Black', 405, 1],
  ['iPhone 13', 128, 'A-', 86, 'Black', 405, 2],
  ['iPhone 13', 512, 'A', 85, 'Black', 430, 1],
  ['iPhone 13', 512, 'A-', 100, 'Black', 450, 1],
  ['iPhone 13', 512, 'A-', 100, 'Blue', 450, 1],
  ['iPhone 13', 512, 'A-', 100, 'Pink', 450, 1],
  ['iPhone 13 Pro', 128, 'A', 100, 'Black', 510, 5],
  ['iPhone 13 Pro', 128, 'A', 97, 'Black', 490, 1],
  ['iPhone 13 Pro', 128, 'A-', 100, 'Black', 505, 1],
  ['iPhone 13 Pro', 128, 'A-', 98, 'Black', 490, 1],
  ['iPhone 13 Pro', 128, 'A-', 97, 'Black', 490, 1],
  ['iPhone 13 Pro', 128, 'A-', 93, 'Black', 490, 1],
  ['iPhone 13 Pro Max', 256, 'A+', 100, 'Gold', 620, 1],
  // --- SERIE IPHONE 14 ---
  ['iPhone 14', 128, 'A', 100, 'Purple', 440, 1],
  ['iPhone 14', 128, 'A', 100, 'White', 440, 1],
  ['iPhone 14', 128, 'A', 100, 'Yellow', 440, 1],
  ['iPhone 14', 128, 'A-', 100, 'Red', 440, 1],
  ['iPhone 14 Pro', 128, 'A', 100, 'Black', 580, 4],
  ['iPhone 14 Pro', 512, 'A-', 100, 'Purple', 600, 1],
  ['iPhone 14 Pro Max', 128, 'A', 89, 'Purple', 630, 1],
  ['iPhone 14 Pro Max', 128, 'A', 87, 'Black', 630, 1],
  ['iPhone 14 Pro Max', 128, 'A', 85, 'Black', 630, 1],
  ['iPhone 14 Pro Max', 128, 'A-', 100, 'Black', 655, 1],
  ['iPhone 14 Pro Max', 128, 'A-', 86, 'Black', 630, 1],
  ['iPhone 14 Pro Max', 256, 'A-', 100, 'Black', 700, 2],
  ['iPhone 14 Pro Max', 256, 'A-', 100, 'White', 700, 1],
  ['iPhone 14 Pro Max', 256, 'A-', 86, 'Black', 680, 1],
  ['iPhone 14 Pro Max', 256, 'A-', 85, 'Black', 680, 1],
  // --- SERIE IPHONE 15 ---
  ['iPhone 15', 128, 'A', 100, 'Black', 580, 1],
  ['iPhone 15', 128, 'A', 85, 'Black', 550, 1],
  ['iPhone 15', 128, 'A-', 100, 'Pink', 580, 1],
  ['iPhone 15 Pro', 128, 'A', 100, 'Black', 710, 1],
  ['iPhone 15 Pro', 128, 'A', 100, 'Blue', 710, 1],
  ['iPhone 15 Pro', 128, 'A', 88, 'Blue', 675, 1],
  ['iPhone 15 Pro', 128, 'A', 86, 'Blue', 675, 2],
  ['iPhone 15 Pro', 128, 'A', 86, 'Silver', 675, 1],
  ['iPhone 15 Pro', 128, 'A-', 100, 'Black', 705, 1],
  ['iPhone 15 Pro', 128, 'A-', 100, 'Blue', 705, 1],
  ['iPhone 15 Pro', 128, 'A-', 97, 'Blue', 675, 1],
  ['iPhone 15 Pro', 128, 'A-', 87, 'Blue', 570, 1],
  ['iPhone 15 Pro Max', 256, 'A+', 100, 'Blue', 830, 1],
  ['iPhone 15 Pro Max', 256, 'A', 100, 'White', 810, 1],
  ['iPhone 15 Pro Max', 256, 'A', 93, 'Black', 800, 1],
  ['iPhone 15 Pro Max', 256, 'A', 89, 'White', 790, 1],
  ['iPhone 15 Pro Max', 256, 'A', 86, 'White', 790, 1],
  ['iPhone 15 Pro Max', 256, 'A-', 87, 'Blue', 790, 1],
  ['iPhone 15 Pro Max', 256, 'A-', 86, 'Black', 790, 1],
  // --- SERIE IPHONE 16 ---
  ['iPhone 16 Plus', 128, 'A+', 92, 'Black', 780, 1],
  ['iPhone 16 Pro', 128, 'A-', 93, 'Desert', 820, 1],
  ['iPhone 16 Pro Max', 256, 'A', 94, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A', 93, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A+', 93, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A+', 93, 'Desert', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A+', 92, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A', 92, 'Black', 970, 2],
  ['iPhone 16 Pro Max', 256, 'A', 91, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A', 90, 'Black', 970, 2],
  ['iPhone 16 Pro Max', 256, 'A', 84, 'Black', 970, 1],
  ['iPhone 16 Pro Max', 256, 'A-', 96, 'Black', 965, 1],
  ['iPhone 16 Pro Max', 256, 'A-', 94, 'Black', 965, 1],
  ['iPhone 16 Pro Max', 256, 'A-', 91, 'Black', 965, 1],
  ['iPhone 16 Pro Max', 256, 'A-', 88, 'Desert', 965, 1],
  ['iPhone 16 Pro Max', 512, 'A+', 85, 'Silver', 990, 1],
  // --- SERIE IPHONE 17 ---
  ['iPhone 17 Pro Max', 256, 'A+', 100, 'Orange', 1290, 2],
  ['iPhone 17 Pro Max', 512, 'A+', 100, 'Blue', 1420, 1],
  ['iPhone 17 Pro Max', 512, 'A+', 100, 'Orange', 1420, 1],
]

const MODEL_KEY = {
  'iPhone 13': 'IP13',
  'iPhone 13 Pro': 'IP13PRO',
  'iPhone 13 Pro Max': 'IP13PM',
  'iPhone 14': 'IP14',
  'iPhone 14 Pro': 'IP14PRO',
  'iPhone 14 Pro Max': 'IP14PM',
  'iPhone 15': 'IP15',
  'iPhone 15 Pro': 'IP15PRO',
  'iPhone 15 Pro Max': 'IP15PM',
  'iPhone 16 Plus': 'IP16PLUS',
  'iPhone 16 Pro': 'IP16PRO',
  'iPhone 16 Pro Max': 'IP16PM',
  'iPhone 17 Pro Max': 'IP17PM',
}
const COLOR_KEY = {
  Black: 'BLK', Blue: 'BLU', Pink: 'PNK', Purple: 'PUR', White: 'WHT',
  Yellow: 'YEL', Red: 'RED', Gold: 'GLD', Desert: 'DZR', Silver: 'SLV', Orange: 'ORG',
}
const CAL_KEY = { 'A+': 'APLUS', A: 'A', 'A-': 'AMINUS' }

function priceFor(usd) {
  const transferencia = Math.round(usd * USD_RATE)
  return {
    transferencia,
    mercadopago: Math.round(transferencia * (1 + MP_MARKUP)),
    costo: Math.round(transferencia * COST_FACTOR),
  }
}

function buildDesired() {
  const used = new Set()
  return LIST.map(([model, stor, cal, bat, color, usd, stock]) => {
    const base = `IPHU-${MODEL_KEY[model]}-${stor}-${CAL_KEY[cal]}-B${bat}-${COLOR_KEY[color]}`
    let sku = base
    if (used.has(sku)) sku = `${base}-P${usd}`
    if (used.has(sku)) sku = `${base}-P${usd}-${used.size}`
    used.add(sku)
    const { costo, transferencia, mercadopago } = priceFor(usd)
    const condicion = `Calidad ${cal} · Bat ${bat}% · ${color}`
    return {
      sku,
      nombre: `${model} ${stor}GB (Usado · ${condicion})`,
      descripcion: `${model} ${stor}GB usado. ${condicion}. Garantía 30 días. Stock del proveedor actualizado.`,
      usd, costo, transferencia, mercadopago,
      model, stor, cal, bat, color, stock,
      condicion,
    }
  })
}

function especFor(d) {
  return {
    _condicion: 'usado',
    _calidad: d.cal,
    _bateria: d.bat,
    _color: d.color,
    _almacenamiento: `${d.stor}GB`,
    _usd_venta: d.usd,
    _usd_rate: USD_RATE,
    _costo_original: d.costo,
    _pricing: {
      costo: d.costo,
      transferencia: d.transferencia,
      mercadopago: d.mercadopago,
      usdRate: USD_RATE,
      usdVentaFinal: d.usd,
      costoEstimado: true,
      nota: 'usd listado = precio de venta final (transferencia); costo interno estimado 85%',
    },
  }
}

function applyToProduct(p, d) {
  const esp = {
    ...(p.especificaciones && typeof p.especificaciones === 'object' ? p.especificaciones : {}),
    ...especFor(d),
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
    condicion: 'usado',
    garantia: '30 días',
    tipo_venta: 'directa',
    stock: d.stock,
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
    condicion: 'usado',
    garantia: '30 días',
    tipo_venta: 'directa',
    stock: d.stock,
    estado: 'activo',
    active: true,
    fuente_origen: 'archivo_normalizado',
    moneda: 'ARS',
    imagenes,
    image: imagenes[0],
    especificaciones: especFor(d),
    specs: [],
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

function isUsedIphone(p) {
  return p.condicion === 'usado' && /iphone/i.test(String(p.nombre || ''))
}

async function main() {
  const desired = buildDesired()
  const totalStock = desired.reduce((s, d) => s + d.stock, 0)
  console.log(`[used] Catálogo: ${desired.length} SKUs, ${totalStock} unidades (dry=${DRY})`)

  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const existing = (mock.products || []).filter(isUsedIphone)
  console.log(`[used] Existentes en mock: ${existing.length}`)

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

  console.log(`[used] Updates: ${updates.length} | Altas: ${news.length} | Bajas: ${unmapped.length}`)
  for (const u of updates) {
    const delta = u.desired.transferencia - (u.existing.precio_transferencia || 0)
    console.log(`  ~ ${u.existing.sku} | usd ${u.desired.usd} | ${u.existing.precio_transferencia} → ${u.desired.transferencia} (${delta >= 0 ? '+' : ''}${delta}) stock ${u.desired.stock}`)
  }
  for (const n of news) console.log(`  + ${n.sku} | ${n.nombre} | usd ${n.usd} | venta ${n.transferencia} | stock ${n.stock}`)
  for (const b of unmapped) console.log(`  - ${b.sku} | ${b.nombre}`)

  if (DRY) {
    console.log('[used] dry-run: no se escribió nada')
    return
  }

  // --- Mock ---
  const removeIds = new Set(unmapped.map(p => String(p.id)))
  const byId = new Map(mock.products.map(p => [String(p.id), p]))
  for (const u of updates) byId.set(String(u.existing.id), applyToProduct(u.existing, u.desired))
  const created = []
  for (const n of news) {
    const id = `u-${n.sku.toLowerCase()}`
    const p = newProduct(n, id)
    byId.set(id, p)
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
  const usedCount = mock.products.filter(isUsedIphone).length
  console.log(`[used] Mock: total ${mock.products.length}, usados ${usedCount}`)

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
      const product = newProduct(d, d.sku)
      const { id, ...doc } = product
      await col.doc(d.sku).set({ ...doc, createdAt: now, updatedAt: now })
      wCreates++
    }
  }
  for (const [sku, entry] of fsBySku) {
    const data = entry.data
    if (!isUsedIphone(data)) continue
    if (desiredSkus.has(sku)) continue
    await entry.ref.delete()
    wDeletes++
    console.log(`  firestore delete: ${sku} | ${data.nombre}`)
  }
  console.log(`[used] Firestore: ${wUpdates} updates, ${wCreates} creates, ${wDeletes} deletes`)
}

main().catch(e => {
  console.error('[used] Fatal:', e)
  process.exit(1)
})
