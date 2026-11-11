/**
 * Actualiza el catálogo del proveedor Insumos Acuario (SSD, RAM, GPU) y aplica
 * la curaduría de visibilidad.
 *
 * Uso:
 *   node scripts/update-insumosacuario.mjs [--dry-run] [--file scrape.json]
 *
 * Qué hace:
 *  1. Toma el scrape más reciente (o el indicado con --file).
 *  2. Normaliza precios (costo × 1.20) con la regla existente.
 *  3. Upsert por SKU en mock + Firestore (sin duplicar; los duplicados se ocultan).
 *  4. Publica SOLO: SSD, RAM y placas de video del proveedor + celulares nuevos + MacBooks.
 *  5. Todo lo demás queda oculto (no se borra).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { normalizeForStore } from '../server/ingesta/scrapers/insumosacuario.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const DRY = process.argv.includes('--dry-run')

const TARGET_CATS = new Set(['ssd-nvme', 'ssd-sata', 'ram', 'ram-sodimm', 'memorias', 'gpus'])
const up = v => String(v || '').trim().toUpperCase()
const now = new Date().toISOString()

function scrapeFile() {
  const i = process.argv.indexOf('--file')
  if (i >= 0) return process.argv[i + 1]
  const files = fs.readdirSync(ROOT)
    .filter(f => /^insumosacuario-scrape-.*\.json$/.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!files.length) throw new Error('No hay archivos insumosacuario-scrape-*.json')
  return path.join(ROOT, files[0].f)
}

const file = scrapeFile()
const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
const normalized = normalizeForStore(raw)
// Dedupe por SKU (el proveedor puede repetir productos entre subcategorías)
const bySku = new Map()
for (const p of normalized) {
  const sku = up(p.sku)
  if (sku && !bySku.has(sku)) bySku.set(sku, p)
}
const items = [...bySku.values()]
const targetItems = items.filter(p => TARGET_CATS.has(p.categoria))
const targetSkus = new Set(targetItems.map(p => up(p.sku)))

console.log(`[update] archivo: ${path.basename(file)}`)
console.log(`[update] scrape: ${raw.length} items | únicos: ${items.length}`)
console.log(`[update] a publicar del proveedor: ${targetItems.length} (SSD/RAM/GPU)`)
const byCat = {}
for (const p of targetItems) byCat[p.categoria] = (byCat[p.categoria] || 0) + 1
console.log('[update] detalle:', byCat)

if (DRY) {
  console.log('[update] dry-run: no se escribió nada')
  process.exit(0)
}

/* ---------------- Mock ---------------- */
const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
const products = mock.products || []
const mockBySku = new Map()
for (const p of products) {
  const sku = up(p.sku)
  if (sku && !mockBySku.has(sku)) mockBySku.set(sku, p)
}

function applyScrapedToProduct(p, s) {
  const imagenes = Array.isArray(s.imagenes) && s.imagenes.length ? s.imagenes : (Array.isArray(p.imagenes) ? p.imagenes : [])
  return {
    ...p,
    nombre: s.nombre, name: s.nombre,
    precio: s.precio, price: s.precio,
    precio_transferencia: s.precio_transferencia,
    precio_mercadopago: s.precio_mercadopago,
    marca: s.marca, brand: s.marca, fabricante: s.marca,
    categoria: s.categoria, category: s.categoria,
    stock: s.stock,
    tipo_venta: 'directa',
    descripcion: s.descripcion, description: s.descripcion,
    imagenes, image: imagenes[0] || null,
    fuente_origen: 'scraping_insumosacuario',
    updatedAt: now,
  }
}

function newMockProduct(s) {
  const p = applyScrapedToProduct({
    id: `ia-${up(s.sku).toLowerCase().replace(/[^A-Z0-9._-]/g, '-')}`,
    sku: up(s.sku),
    specs: [], emoji: '📦', rating: 4.5, reviews: 0,
    condicion: 'nuevo', estado: 'activo', active: true,
    moneda: 'ARS',
  }, s)
  p.specs = Object.values(p.especificaciones || {})
  p.active = s.stock > 0
  p.estado = s.stock > 0 ? 'activo' : 'agotado'
  p.visibleEnTienda = false
  p.createdAt = now
  return p
}

let mockNew = 0
let mockUpd = 0
for (const s of items) {
  const sku = up(s.sku)
  const existing = mockBySku.get(sku)
  if (existing) {
    Object.assign(existing, applyScrapedToProduct(existing, s))
    mockUpd++
  } else {
    const p = newMockProduct(s)
    products.push(p)
    mockBySku.set(sku, p)
    mockNew++
  }
}

// Curaduría mock
for (const p of products) {
  const sku = up(p.sku)
  const isScraper = p.fuente_origen === 'scraping_insumosacuario'
  const isNewPhone = String(p.categoria || '').toLowerCase() === 'celulares' && p.condicion !== 'usado'
  const isMac = /macbook/i.test(String(p.nombre || ''))
  p.visibleEnTienda = isNewPhone || isMac || (isScraper && targetSkus.has(sku))
}
mock.products = products
fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
const mockVisible = products.filter(p => p.visibleEnTienda !== false).length
console.log(`[update] mock: ${products.length} total | +${mockNew} nuevos | ${mockUpd} actualizados | ${mockVisible} visibles`)

/* ---------------- Firestore ---------------- */
const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
const db = getFirestoreDb()
const col = db.collection(COLLECTIONS.PRODUCTS)
const snap = await col.get()
const docs = snap.docs.map(d => ({ ref: d.ref, id: d.id, data: d.data() }))

const fsBySku = new Map()
for (const d of docs) {
  const sku = up(d.data.sku)
  if (!sku) continue
  if (!fsBySku.has(sku)) fsBySku.set(sku, [])
  fsBySku.get(sku).push(d)
}

const writes = new Map() // ref.path -> { ref, data }
function set(ref, data) {
  const prev = writes.get(ref.path)
  writes.set(ref.path, { ref, data: { ...(prev?.data || {}), ...data, updatedAt: now } })
}

function pickPrimary(list, sku) {
  return list.find(d => d.id === sku) || list.find(d => d.data.active !== false) || list[0]
}

let created = 0
let updated = 0
let hiddenDups = 0
for (const s of items) {
  const sku = up(s.sku)
  const list = fsBySku.get(sku) || []
  const imagenes = s.imagenes && s.imagenes.length ? s.imagenes : null
  const base = {
    nombre: s.nombre, name: s.nombre,
    precio: s.precio, price: s.precio,
    precio_transferencia: s.precio_transferencia,
    precio_mercadopago: s.precio_mercadopago,
    marca: s.marca, brand: s.marca, fabricante: s.marca,
    categoria: s.categoria, category: s.categoria,
    stock: s.stock,
    active: s.stock > 0,
    estado: s.stock > 0 ? 'activo' : 'agotado',
    tipo_venta: 'directa',
    descripcion: s.descripcion, description: s.descripcion,
    fuente_origen: 'scraping_insumosacuario',
    moneda: 'ARS',
    ...(imagenes ? { imagenes, image: imagenes[0] } : {}),
  }
  const primary = list.length ? pickPrimary(list, sku) : null
  if (primary) {
    set(primary.ref, { ...base, visibleEnTienda: targetSkus.has(sku) })
    updated++
    for (const dup of list.filter(d => d !== primary)) {
      set(dup.ref, { visibleEnTienda: false })
      hiddenDups++
    }
  } else {
    // Los SKU pueden tener "/" u otros caracteres inválidos como ID de documento.
    const docId = up(sku).replace(/[^A-Z0-9._-]/g, '-')
    const ref = col.doc(docId)
    set(ref, {
      ...base,
      sku, active: s.stock > 0, estado: s.stock > 0 ? 'activo' : 'agotado',
      condicion: 'nuevo', visibleEnTienda: targetSkus.has(sku),
      specs: [], emoji: '📦', rating: 4.5, reviews: 0,
      createdAt: now,
    })
    created++
  }
}

// Visibilidad: ocultar del proveedor lo que ya no está en el scrape fresco
let hiddenRemoved = 0
for (const d of docs) {
  if (d.data.fuente_origen !== 'scraping_insumosacuario') continue
  if (targetSkus.has(up(d.data.sku))) continue
  if (d.data.visibleEnTienda !== false) {
    set(d.ref, { visibleEnTienda: false })
    hiddenRemoved++
  }
}

// Publicar celulares nuevos + MacBooks
let phones = 0
let macs = 0
for (const d of docs) {
  const nombre = String(d.data.nombre || '')
  const isNewPhone = String(d.data.categoria || '').toLowerCase() === 'celulares' && d.data.condicion !== 'usado'
  const isMac = /macbook/i.test(nombre)
  if (!isNewPhone && !isMac) continue
  if (d.data.visibleEnTienda === false) {
    set(d.ref, { visibleEnTienda: true })
    if (isNewPhone) phones++
    if (isMac) macs++
  }
}

const ops = [...writes.values()]
const CHUNK = 400
for (let i = 0; i < ops.length; i += CHUNK) {
  const batch = db.batch()
  for (const op of ops.slice(i, i + CHUNK)) batch.set(op.ref, op.data, { merge: true })
  await batch.commit()
}

console.log(`[update] firestore: ${updated} actualizados | ${created} creados | ${hiddenDups} duplicados ocultos`)
console.log(`[update] firestore: ${hiddenRemoved} del proveedor fuera de lista ocultados`)
console.log(`[update] firestore: ${phones} celulares nuevos publicados | ${macs} macbooks publicados`)
console.log(`[update] firestore: ${ops.length} escrituras | OK`)
