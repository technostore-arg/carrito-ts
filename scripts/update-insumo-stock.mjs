/**
 * Re-scrapea insumosacuario.com.ar y actualiza TODO el stock/precios de hardware
 * en .mock-data.json + Firestore ( TechnoStore y FuturoHard comparten catálogo ).
 * Costo del sitio → transferencia = costo × 1.20 → MP = transfer × 1.16
 * Uso: node scripts/update-insumo-stock.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { scrapeAll, inferBrand } from '../server/ingesta/scrapers/insumosacuario.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const DRY = process.argv.includes('--dry-run')

// Categorías reales por subcategoría del sitio (solo cats válidas del server)
const CAT_BY_SUB = {
  coolers: 'coolers',
  gabinetes: 'gabinetes',
  'pasta-termica': 'accesorios',
  'discos-solidos-pci-e-m2': 'ssd-nvme',
  'memorias-ram-dimm': 'ram',
  'memorias-ram-sodimm': 'ram-sodimm',
  'discos-solidos-sata': 'ssd-sata',
  'procesadores-amd': 'procesadores',
  'gabinetes-con-fuente-': 'gabinetes',
  fuentes: 'accesorios',
  'motherboard-amd': 'accesorios',
  'motherboard-intel': 'accesorios',
  'placas-de-video-amd': 'gpus',
  'placas-de-video-nvidia': 'gpus',
  'procesadores-intel': 'procesadores',
  'discos-internos-hdd': 'accesorios',
  'memorias-p-server': 'memorias',
}

// Categorías del universo FuturoHard (vertica IA) — para marca=futurohard en altas
const FH_CATS = new Set(['gpus', 'memorias', 'ram', 'ram-sodimm', 'ssd', 'ssd-nvme', 'ssd-sata', 'procesadores', 'workstations'])

function priceFromCost(costo) {
  const transferencia = Math.round(costo * 1.20)
  const mercadopago = Math.round(transferencia * 1.16)
  return { costo, transferencia, mercadopago }
}

function normalizeRow(p) {
  const sub = p.category
  const categoria = CAT_BY_SUB[sub] || 'accesorios'
  const costo = Number(p.price) || 0
  const { transferencia, mercadopago } = priceFromCost(costo)
  return {
    sku: String(p.sku).toUpperCase(),
    nombre: p.name,
    costo,
    transferencia,
    mercadopago,
    categoria,
    stock: p.inStock ? 10 : 0,
    imagen: p.image || null,
    url: p.url || null,
    marca: inferBrand(p.name),
  }
}

function applyToExisting(ex, row) {
  const esp = {
    ...(ex.especificaciones && typeof ex.especificaciones === 'object' ? ex.especificaciones : {}),
    _costo_original: row.costo,
    _pricing: { costo: row.costo, transferencia: row.transferencia, mercadopago: row.mercadopago, markup: 0.2 },
    ...(row.url ? { _url: row.url } : {}),
  }
  const imagenes = row.imagen
    ? [row.imagen]
    : Array.isArray(ex.imagenes) ? ex.imagenes : ex.image ? [ex.image] : []
  // Conservar marca/categoria existentes si ya estaban bien (evita cambiar filtros a mitad de catálogo)
  const marca = ex.marca && ex.marca !== 'insumosacuario' ? ex.marca : row.marca
  const categoria = ex.categoria || row.categoria
  return {
    ...ex,
    nombre: row.nombre,
    name: row.nombre,
    descripcion: row.nombre,
    description: row.nombre,
    precio: row.costo,
    price: row.costo,
    precio_transferencia: row.transferencia,
    precio_mercadopago: row.mercadopago,
    marca,
    brand: marca,
    categoria,
    category: categoria,
    stock: row.stock,
    active: row.stock > 0,
    estado: row.stock > 0 ? 'activo' : 'agotado',
    imagenes,
    image: imagenes[0] || null,
    fuente_origen: 'scraping_insumosacuario',
    moneda: 'ARS',
    tipo_venta: 'directa',
    sku: row.sku,
    especificaciones: esp,
    updatedAt: new Date().toISOString(),
  }
}

function newProduct(row, id) {
  const esp = {
    _costo_original: row.costo,
    _pricing: { costo: row.costo, transferencia: row.transferencia, mercadopago: row.mercadopago, markup: 0.2 },
    ...(row.url ? { _url: row.url } : {}),
  }
  // Altas: hardware de vertical IA → futurohard (visible en ambas vidrieras);
  // el resto → marca de fabricante (TechnoStore; FuturoHard muestra por categoría).
  const marca = FH_CATS.has(row.categoria) ? 'futurohard' : row.marca
  const imagenes = row.imagen ? [row.imagen] : []
  return {
    id,
    sku: row.sku,
    nombre: row.nombre,
    name: row.nombre,
    descripcion: row.nombre,
    description: row.nombre,
    precio: row.costo,
    price: row.costo,
    precio_transferencia: row.transferencia,
    precio_mercadopago: row.mercadopago,
    marca,
    brand: marca,
    fabricante: row.marca !== 'Genérica' ? row.marca : marca,
    categoria: row.categoria,
    category: row.categoria,
    stock: row.stock,
    active: row.stock > 0,
    estado: row.stock > 0 ? 'activo' : 'agotado',
    tipo_venta: 'directa',
    imagenes,
    image: imagenes[0] || null,
    especificaciones: esp,
    specs: [],
    fuente_origen: 'scraping_insumosacuario',
    moneda: 'ARS',
    emoji: '🔧',
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

async function main() {
  console.log('[insumo] Scraping insumosacuario.com.ar/hardware ...')
  const scraped = await scrapeAll()
  console.log(`[insumo] Scrapeados: ${scraped.length}`)

  const rows = scraped.map(normalizeRow)
  const bySku = new Map(rows.map(r => [r.sku, r]))

  if (DRY) {
    let up = 0, add = 0, miss = 0
    const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
    const existing = (mock.products || []).filter(p => p.fuente_origen === 'scraping_insumosacuario')
    for (const ex of existing) {
      const row = bySku.get(String(ex.sku || '').toUpperCase())
      if (!row) { miss++; continue }
      if (Math.abs((ex.precio_transferencia || 0) - row.transferencia) > 1 || (ex.stock > 0) !== (row.stock > 0)) up++
    }
    const existingSkus = new Set(existing.map(p => String(p.sku || '').toUpperCase()))
    for (const r of rows) if (!existingSkus.has(r.sku)) add++
    console.log(`[insumo] dry-run → updates≈${up}, altas≈${add}, fuera de stock/catálogo=${miss}, total existentes=${existing.length}`)
    const sample = rows.slice(0, 5)
    for (const s of sample) console.log(`  ${s.sku} | ${s.nombre.slice(0, 50)} | costo ${s.costo} → t ${s.transferencia} / mp ${s.mercadopago} | ${s.categoria} | stock ${s.stock}`)
    return
  }

  // --- Mock ---
  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const existing = (mock.products || []).filter(p => p.fuente_origen === 'scraping_insumosacuario')
  const existingBySku = new Map(existing.map(p => [String(p.sku || '').toUpperCase(), p]))

  let mUpd = 0, mNew = 0, mOos = 0, mGone = 0
  const newRows = []

  for (const row of rows) {
    const ex = existingBySku.get(row.sku)
    if (ex) {
      const before = { pt: ex.precio_transferencia, stock: ex.stock }
      const updated = applyToExisting(ex, row)
      Object.assign(ex, updated)
      if (before.pt !== updated.precio_transferencia || before.stock !== updated.stock) mUpd++
      if (updated.stock === 0) mOos++
    } else {
      newRows.push(row)
      mNew++
    }
  }

  // Productos del scrape que ya no aparecen → stock 0 (no borrar historial)
  for (const ex of existing) {
    if (!bySku.has(String(ex.sku || '').toUpperCase())) {
      if (ex.stock !== 0) { ex.stock = 0; ex.active = false; ex.estado = 'agotado'; mGone++ }
    }
  }

  for (const row of newRows) {
    const id = randomId()
    mock.products.push(newProduct(row, id))
  }

  // Persistir también snapshot del scrape para trazabilidad
  const stamp = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(path.join(ROOT, `insumosacuario-scrape-${stamp}.json`), JSON.stringify(rows, null, 2))

  fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
  console.log(`[insumo] Mock: ${mUpd} updates, ${mNew} altas, ${mOos} sin stock, ${mGone} fuera de catálogo proveedor → stock 0`)
  console.log(`[insumo] Mock total productos: ${mock.products.length}`)

  // --- Firestore ---
  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  const db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)

  const snap = await col.get()
  const fsBySku = new Map()
  const fsInsumo = []
  for (const d of snap.docs) {
    const data = d.data()
    const sku = String(data.sku || '').toUpperCase()
    if (sku) fsBySku.set(sku, { ref: d.ref, data })
    if (data.fuente_origen === 'scraping_insumosacuario') fsInsumo.push({ ref: d.ref, data, sku })
  }

  const now = new Date().toISOString()
  let fUpd = 0, fNew = 0, fOos = 0, fGone = 0

  // Upsert por SKU del scrape
  for (const row of rows) {
    const hit = fsBySku.get(row.sku)
    if (hit) {
      const product = applyToExisting({ ...hit.data, id: hit.ref.id }, row)
      const { id: _i, ...doc } = product
      await hit.ref.set({ ...doc, updatedAt: now }, { merge: true })
      fUpd++
      if (row.stock === 0) fOos++
    } else {
      const product = newProduct(row, randomId())
      const { id, ...doc } = product
      await col.doc(String(row.sku)).set({ ...doc, createdAt: now, updatedAt: now })
      fNew++
    }
  }

  // Insumos en Firestore que desaparecieron del scrape → stock 0
  for (const entry of fsInsumo) {
    if (!bySku.has(entry.sku)) {
      if ((entry.data.stock || 0) !== 0) {
        await entry.ref.set({ stock: 0, active: false, estado: 'agotado', updatedAt: now }, { merge: true })
        fGone++
      }
    }
  }

  console.log(`[insumo] Firestore: ${fUpd} updates, ${fNew} altas, ${fOos} sin stock, ${fGone} fuera de proveedor → stock 0`)
  console.log('[insumo] Listo. Ambas vidrieras (TechnoStore + FuturoHard) leen el mismo catálogo.')
}

main().catch(e => {
  console.error('[insumo] Fatal:', e)
  process.exit(1)
})
