/**
 * iPhone USADOS (condición: usado, garantía 30 días) → mock + Firestore.
 * Uso: node scripts/update-iphone-used-stock.mjs [--dry-run]
 * Los US$ listados son el COSTO del usado → venta = costo + U$S 100, todo en pesos:
 *   precio (costo interno)      = usd × 1550
 *   precio_transferencia (venta) = (usd + 100) × 1550
 *   precio_mercadopago          = transferencia × 1.16  (recargo por medio de pago)
 * SKU por variante exacta (modelo + almacenamiento + calidad + batería + color).
 * Batería puede ser número exacto (100) o rango ("88-90" → _bateria_min para filtros).
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

// [modelo, almacenamiento GB, calidad, batería % (o rango "88-90"), color, usd_costo, stock, nota?]
const LIST = [
  // --- SERIE IPHONE 16 ---
  ['iPhone 16 Pro', 128, 'A+', '88-90', 'Desert', 710, 1],
  ['iPhone 16 Pro Max', 256, 'A', '88-90', 'Desert', 840, 1],
  ['iPhone 16 Pro Max', 256, 'A', '88-90', 'Natural', 840, 1],
  ['iPhone 16 Pro Max', 256, 'A', '88-90', 'White', 840, 1],
  ['iPhone 16 Pro Max', 256, 'A', '88-90', 'Black', 840, 1],
  // --- SERIE IPHONE 15 ---
  ['iPhone 15 Pro', 128, 'A+', 100, 'Black', 590, 1, 'Ultimo disponible'],
  ['iPhone 15 Pro Max', 256, 'A+', 100, 'Black', 700, 1],
  ['iPhone 15 Pro Max', 256, 'A+', 100, 'Blue', 700, 1],
  ['iPhone 15 Pro Max', 256, 'A+', 100, 'Natural', 700, 1],
  // --- SERIE IPHONE 14 ---
  ['iPhone 14 Pro Max', 128, 'A+', 100, 'Black', 570, 1],
  ['iPhone 14 Pro Max', 128, 'A+', 100, 'Purple', 570, 1],
  ['iPhone 14 Pro Max', 128, 'A+', 100, 'Gold', 570, 1],
  ['iPhone 14 Pro Max', 128, 'A+', 100, 'Silver', 570, 1],
  // --- SERIE IPHONE 13 ---
  ['iPhone 13 Pro', 128, 'A+', 100, 'Graphite', 420, 1],
  ['iPhone 13 Pro', 128, 'A+', 100, 'Blue', 420, 1],
  ['iPhone 13 Pro', 128, 'A+', 100, 'Silver', 420, 1],
  ['iPhone 13 Pro', 128, 'A+', 100, 'Gold', 420, 1],
  ['iPhone 13 Pro', 128, 'A+', 100, 'Green', 420, 1],
  ['iPhone 13 Pro', 256, 'A+', 100, 'Graphite', 450, 1],
  ['iPhone 13 Pro', 256, 'A+', 100, 'Blue', 450, 1],
  ['iPhone 13 Pro', 256, 'A+', 100, 'Gold', 450, 1],
  ['iPhone 13 Pro', 256, 'A+', 100, 'Green', 450, 1],
  ['iPhone 13 Pro Max', 256, 'A+', 100, 'Graphite', 520, 1],
  ['iPhone 13 Pro Max', 256, 'A+', 100, 'Blue', 520, 1],
  ['iPhone 13 Pro Max', 256, 'A+', 100, 'Green', 520, 1],
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
  Natural: 'NAT', Graphite: 'GRF', Green: 'GRN',
}
const CAL_KEY = { 'A+': 'APLUS', A: 'A', 'A-': 'AMINUS' }

const MARGEN_USD = 100 // venta = costo + U$S 100
function priceFor(usdCosto) {
  const costo = Math.round(usdCosto * USD_RATE)
  const transferencia = Math.round((usdCosto + MARGEN_USD) * USD_RATE)
  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))
  return { costo, transferencia, mercadopago }
}

function buildDesired() {
  const used = new Set()
  return LIST.map(([model, stor, cal, bat, color, usd, stock, nota = null]) => {
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
      descripcion: `${model} ${stor}GB usado. ${condicion}. Garantía 30 días.${nota ? ' ' + nota + '.' : ''}`,
      usd, costo, transferencia, mercadopago,
      model, stor, cal, bat, color, stock,
      condicion, nota,
    }
  })
}

function especFor(d) {
  const batMin = typeof d.bat === 'number' ? d.bat : Number(String(d.bat).split('-')[0])
  return {
    _condicion: 'usado',
    _calidad: d.cal,
    _bateria: d.bat,
    _bateria_min: batMin,
    _color: d.color,
    _almacenamiento: `${d.stor}GB`,
    _usd_costo: d.usd,
    _usd_rate: USD_RATE,
    ...(d.nota ? { _nota: d.nota } : {}),
    _pricing: {
      costo: d.costo,
      transferencia: d.transferencia,
      mercadopago: d.mercadopago,
      usdRate: USD_RATE,
      usdCosto: d.usd,
      margenUsd: MARGEN_USD,
      nota: 'usd listado = costo del usado; venta = (costo + U$S100) × 1550; todo expresado en pesos',
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
