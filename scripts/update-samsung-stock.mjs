/**
 * Actualiza Samsung en .mock-data.json + Firestore con el listado de costos USD.
 * Uso: node scripts/update-samsung-stock.mjs [--dry-run]
 * Precio: costo_usd * 1550 → + fijo tramo (50/80/100) * 1550 = transferencia; MP = transfer * 1.16
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

// Listado de costo del proveedor (USD). Colores se conservan en descripcion/nombre.
// Precio distinto por color → SKU/color variant cuando el costo difiere.
const LIST = [
  // Gama alta
  { key: 'S26-256', nombre: 'Samsung Galaxy S26 12GB 256GB', usd: 760, colores: 'Black, Blue, White, Violet' },
  { key: 'S26-512', nombre: 'Samsung Galaxy S26 12GB 512GB', usd: 840, colores: 'Blue' },
  { key: 'S26PLUS-256', nombre: 'Samsung Galaxy S26 Plus 12GB 256GB', usd: 845, colores: 'Blue, White, Violet' },
  { key: 'S26PLUS-512', nombre: 'Samsung Galaxy S26 Plus 12GB 512GB', usd: 960, colores: 'White' },
  { key: 'S26FE-128', nombre: 'Samsung Galaxy S26 FE 8GB 128GB', usd: 720, colores: 'Graphite' },
  { key: 'S26FE-256', nombre: 'Samsung Galaxy S26 FE 8GB 256GB', usd: 800, colores: 'Graphite' },
  { key: 'S26FE-512', nombre: 'Samsung Galaxy S26 FE 8GB 512GB', usd: 980, colores: 'Graphite' },
  { key: 'S26ULTRA-256', nombre: 'Samsung Galaxy S26 Ultra 12GB 256GB', usd: 965, colores: 'Black, Blue, White', nota: 'Violet U$S 970' },
  { key: 'S26ULTRA-256-V', nombre: 'Samsung Galaxy S26 Ultra 12GB 256GB Violet', usd: 970, colores: 'Violet' },
  { key: 'S26ULTRA-512', nombre: 'Samsung Galaxy S26 Ultra 12GB 512GB', usd: 1110, colores: 'Black, Blue, Violet, White' },
  { key: 'S26ULTRA-1TB-W', nombre: 'Samsung Galaxy S26 Ultra 16GB 1TB White', usd: 1345, colores: 'White' },
  { key: 'S26ULTRA-1TB', nombre: 'Samsung Galaxy S26 Ultra 16GB 1TB', usd: 1355, colores: 'Black, Violet' },
  { key: 'S24FE-128', nombre: 'Samsung Galaxy S24 FE 5G 8GB 128GB', usd: 510, colores: 'Graphite' },
  { key: 'S25FE-256', nombre: 'Samsung Galaxy S25 FE 8GB 256GB', usd: 600, colores: 'Jet Black', nota: 'Navy U$S 605' },
  { key: 'S25FE-256-N', nombre: 'Samsung Galaxy S25 FE 8GB 256GB Navy', usd: 605, colores: 'Navy' },
  { key: 'S25FE-512', nombre: 'Samsung Galaxy S25 FE 8GB 512GB', usd: 670, colores: 'Navy' },
  { key: 'S25ULTRA-256', nombre: 'Samsung Galaxy S25 Ultra 12GB 256GB', usd: 830, colores: 'Black, Silverblue, Blue', nota: 'Gray/White Silver U$S 850' },
  { key: 'S25ULTRA-256-G', nombre: 'Samsung Galaxy S25 Ultra 12GB 256GB Gray', usd: 850, colores: 'Gray, White Silver' },
  { key: 'S25ULTRA-512', nombre: 'Samsung Galaxy S25 Ultra 12GB 512GB', usd: 900, colores: 'Black, Gray, White Silver, Silverblue' },
  { key: 'S25ULTRA-1TB', nombre: 'Samsung Galaxy S25 Ultra 12GB 1TB', usd: 965, colores: 'Black, Gray, White Silver, Silverblue' },
  { key: 'ZFLIP8-256', nombre: 'Samsung Galaxy Z Flip 8 12GB 256GB', usd: 1000, colores: 'Cream, Pink' },
  { key: 'ZFLIP8-512', nombre: 'Samsung Galaxy Z Flip 8 12GB 512GB', usd: 1150, colores: 'Graphite', nota: 'Cream U$S 1260' },
  { key: 'ZFLIP8-512-C', nombre: 'Samsung Galaxy Z Flip 8 12GB 512GB Cream', usd: 1260, colores: 'Cream' },
  { key: 'ZFOLD8-256', nombre: 'Samsung Galaxy Z Fold 8 12GB 256GB', usd: 1480, colores: 'Graphite, Cream' },
  { key: 'ZFOLD8-512', nombre: 'Samsung Galaxy Z Fold 8 12GB 512GB', usd: 1680, colores: 'Lavender, Graphite' },
  { key: 'ZFOLD8U-256', nombre: 'Samsung Galaxy Z Fold 8 Ultra 12GB 256GB', usd: 1780, colores: 'Cream, Violet, Graphite' },
  { key: 'ZFOLD8U-512', nombre: 'Samsung Galaxy Z Fold 8 Ultra 12GB 512GB', usd: 1910, colores: 'Graphite, Cream, Violet' },
  // Gama media
  { key: 'A03C-32', nombre: 'Samsung Galaxy A03 Core 32GB', usd: 120, colores: 'Black' },
  { key: 'A03-32', nombre: 'Samsung Galaxy A03 32GB', usd: 130, colores: 'Black' },
  { key: 'A03-64', nombre: 'Samsung Galaxy A03 64GB', usd: 145, colores: 'Black' },
  { key: 'A03-128', nombre: 'Samsung Galaxy A03 128GB', usd: 165, colores: 'Black' },
  { key: 'A04E-32', nombre: 'Samsung Galaxy A04E 32GB', usd: 135, colores: 'Black, Light Blue' },
  { key: 'A04E-64', nombre: 'Samsung Galaxy A04E 64GB', usd: 150, colores: 'Black' },
  { key: 'A04-32', nombre: 'Samsung Galaxy A04 32GB', usd: 140, colores: 'Black' },
  { key: 'A04S-128', nombre: 'Samsung Galaxy A04S 128GB', usd: 165, colores: 'White' },
  { key: 'A05S-128', nombre: 'Samsung Galaxy A05S 128GB', usd: 175, colores: 'Black' },
  { key: 'A06-64', nombre: 'Samsung Galaxy A06 64GB', usd: 150, colores: 'Light Green' },
  { key: 'A07-64', nombre: 'Samsung Galaxy A07 4GB 64GB', usd: 160, colores: 'Green, Black, Violet' },
  { key: 'A07-128', nombre: 'Samsung Galaxy A07 4GB 128GB', usd: 195, colores: 'Green', nota: 'Black U$S 205' },
  { key: 'A07-128-B', nombre: 'Samsung Galaxy A07 4GB 128GB Black', usd: 205, colores: 'Black' },
  { key: 'A12-64', nombre: 'Samsung Galaxy A12 4GB 64GB Dual SIM', usd: 150, colores: 'Black' },
  { key: 'A16-128', nombre: 'Samsung Galaxy A16 4GB 128GB', usd: 185, colores: 'Black' },
  { key: 'A16-5G-128', nombre: 'Samsung Galaxy A16 5G 6GB 128GB Dual SIM', usd: 245, colores: 'Light Gray, Blue Black' },
  { key: 'A17-128', nombre: 'Samsung Galaxy A17 4GB 128GB', usd: 210, colores: 'Light Blue, Gray' },
  { key: 'A17-256', nombre: 'Samsung Galaxy A17 8GB 256GB', usd: 290, colores: 'Black, Gray' },
  { key: 'A25-128', nombre: 'Samsung Galaxy A25 5G 6GB 128GB Dual SIM', usd: 230, colores: 'Blue Black', nota: 'Usado impecable en caja' },
  { key: 'A26-256', nombre: 'Samsung Galaxy A26 5G 8GB 256GB Dual SIM', usd: 330, colores: 'Pink, White' },
  { key: 'A27-256', nombre: 'Samsung Galaxy A27 5G 8GB 256GB', usd: 350, colores: 'Black', nota: 'Blue U$S 385' },
  { key: 'A27-256-B', nombre: 'Samsung Galaxy A27 5G 8GB 256GB Blue', usd: 385, colores: 'Blue' },
  { key: 'A36-128', nombre: 'Samsung Galaxy A36 5G 6GB 128GB Dual SIM', usd: 320, colores: 'Lavender, Lime' },
  { key: 'A36-256', nombre: 'Samsung Galaxy A36 5G 8GB 256GB Dual SIM', usd: 340, colores: 'Black, Lime, Lavender, White' },
  { key: 'A37-128', nombre: 'Samsung Galaxy A37 5G 6GB 128GB Dual SIM', usd: 370, colores: 'Charcoal, White, Lavender, Gray Green' },
  { key: 'A37-256', nombre: 'Samsung Galaxy A37 5G 8GB 256GB Dual SIM', usd: 425, colores: 'Charcoal, Gray Green' },
  { key: 'A54-128', nombre: 'Samsung Galaxy A54 5G 8GB 128GB', usd: 390, colores: 'Green, Black' },
  { key: 'A56-256', nombre: 'Samsung Galaxy A56 5G 8GB 256GB', usd: 405, colores: 'Graphite', nota: 'Olive U$S 420' },
  { key: 'A56-256-O', nombre: 'Samsung Galaxy A56 5G 8GB 256GB Olive', usd: 420, colores: 'Olive' },
  { key: 'A56-12-256', nombre: 'Samsung Galaxy A56 5G 12GB 256GB', usd: 450, colores: 'Light Gray, Pink, Olive' },
  { key: 'A57-256', nombre: 'Samsung Galaxy A57 5G 8GB 256GB', usd: 440, colores: 'Gray, Navy, Blue' },
  { key: 'A57-12-256', nombre: 'Samsung Galaxy A57 5G 12GB 256GB', usd: 500, colores: 'Gray, Navy, Blue' },
  { key: 'A57-12-512', nombre: 'Samsung Galaxy A57 5G 12GB 512GB', usd: 520, colores: 'Gray, Blue' },
  { key: 'F15-128', nombre: 'Samsung Galaxy F15 5G 128GB Dual SIM', usd: 200, colores: 'Ash Black' },
]

// Mapeo modelo clave → SKU existente (para matchear por modelo, no por hash de línea)
const EXISTING_MATCHERS = [
  { re: /S26 ULTRA.*1TB|GALAXY S26 ULTRA 1TB/i, keys: ['S26ULTRA-1TB-W', 'S26ULTRA-1TB'] },
  { re: /S26 ULTRA.*512|S26ULTRA 512/i, keys: ['S26ULTRA-512'] },
  { re: /S26 ULTRA.*256|S26ULTRA 256/i, keys: ['S26ULTRA-256', 'S26ULTRA-256-V'] },
  { re: /S26 PLUS.*512/i, keys: ['S26PLUS-512'] },
  { re: /S26 PLUS.*256/i, keys: ['S26PLUS-256'] },
  { re: /S26 FE/i, keys: ['S26FE-128', 'S26FE-256', 'S26FE-512'] },
  { re: /S26.*512/i, keys: ['S26-512'] },
  { re: /S26.*256/i, keys: ['S26-256'] },
  { re: /S24 FE/i, keys: ['S24FE-128'] },
  { re: /S25 FE.*512/i, keys: ['S25FE-512'] },
  { re: /S25 FE.*256/i, keys: ['S25FE-256', 'S25FE-256-N'] },
  { re: /S25 FE/i, keys: [] }, // 128 discontinuado en nuevo listado
  { re: /S25 ULTRA.*1TB/i, keys: ['S25ULTRA-1TB'] },
  { re: /S25 ULTRA.*512/i, keys: ['S25ULTRA-512'] },
  { re: /S25 ULTRA/i, keys: ['S25ULTRA-256', 'S25ULTRA-256-G'] },
  { re: /S25 5G/i, keys: [] }, // no está en nuevo listado
  { re: /Z FOLD 8 ULTRA.*512/i, keys: ['ZFOLD8U-512'] },
  { re: /Z FOLD 8 ULTRA/i, keys: ['ZFOLD8U-256'] },
  { re: /Z FOLD 8.*512/i, keys: ['ZFOLD8-512'] },
  { re: /Z FOLD 8/i, keys: ['ZFOLD8-256'] },
  { re: /Z FLIP/i, keys: [] },
  { re: /A03 CORE/i, keys: ['A03C-32'] },
  { re: /A03.*128/i, keys: ['A03-128'] },
  { re: /A03.*64/i, keys: ['A03-64'] },
  { re: /A03.*32/i, keys: ['A03-32'] },
  { re: /A04E.*64/i, keys: ['A04E-64'] },
  { re: /A04E/i, keys: ['A04E-32'] },
  { re: /A04S/i, keys: ['A04S-128'] },
  { re: /A04 /i, keys: ['A04-32'] },
  { re: /A05S/i, keys: ['A05S-128'] },
  { re: /A06/i, keys: ['A06-64'] },
  { re: /A07.*128/i, keys: ['A07-128', 'A07-128-B'] },
  { re: /A07/i, keys: ['A07-64'] },
  { re: /A12/i, keys: ['A12-64'] },
  { re: /A14/i, keys: [] }, // discontinuado
  { re: /F15/i, keys: ['F15-128'] },
  { re: /A16 5G/i, keys: ['A16-5G-128'] },
  { re: /A16/i, keys: ['A16-128'] },
  { re: /A17.*256|A17 256/i, keys: ['A17-256'] },
  { re: /A17/i, keys: ['A17-128'] },
  { re: /A25/i, keys: ['A25-128'] },
  { re: /A26.*256|A26 8\/256/i, keys: ['A26-256'] },
  { re: /A26/i, keys: [] }, // 128 discontinuado
  { re: /A27/i, keys: ['A27-256', 'A27-256-B'] },
  { re: /A36.*256|A36 8\/256/i, keys: ['A36-256'] },
  { re: /A36/i, keys: ['A36-128'] },
  { re: /A37.*256/i, keys: ['A37-256'] },
  { re: /A37/i, keys: ['A37-128'] },
  { re: /A54/i, keys: ['A54-128'] },
  { re: /A56.*12\/256|A56 12\/256/i, keys: ['A56-12-256'] },
  { re: /A56/i, keys: ['A56-256', 'A56-256-O'] },
  { re: /A57.*512/i, keys: ['A57-12-512'] },
  { re: /A57.*12\/256|A57 12GB 256/i, keys: ['A57-12-256'] },
  { re: /A57/i, keys: ['A57-256'] }, // 8/128 discontinuo → mapear a 8/256
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
  const h = createHash('sha256').update('SAMSUNG-' + key).digest('hex').slice(0, 6).toUpperCase()
  return `SAM-${key}-${h}`
}

function buildDesired() {
  return LIST.map(item => {
    const { costo, fx, transferencia, mercadopago } = priceFor(item.usd)
    const sku = skuFor(item.key)
    return {
      key: item.key,
      sku,
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

function matchExisting(existingSam, desired) {
  // existing: productos Samsung actuales; desired: nuevo catálogo
  const used = new Set()
  const updates = [] // { existing, desired }
  const unmappedExisting = []

  for (const ex of existingSam) {
    const nombre = String(ex.nombre || '')
    let matchedKeys = null
    for (const m of EXISTING_MATCHERS) {
      if (m.re.test(nombre)) { matchedKeys = m.keys; break }
    }
    if (!matchedKeys || !matchedKeys.length) {
      unmappedExisting.push(ex)
      continue
    }
    // Preferir un desired cuyo key no esté usado aún
    let pick = null
    for (const k of matchedKeys) {
      const d = desired.find(x => x.key === k)
      if (d && !used.has(d.key)) { pick = d; break }
    }
    if (!pick) {
      // todos los keys del match ya asignados → este existing sobra (duplicado viejo)
      unmappedExisting.push(ex)
      continue
    }
    used.add(pick.key)
    updates.push({ existing: ex, desired: pick })
  }

  const news = desired.filter(d => !used.has(d.key))
  return { updates, news, unmappedExisting }
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
    marca: 'technostore',
    brand: 'technostore',
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
  const imagenes = ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop']
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
    marca: 'technostore',
    brand: 'technostore',
    fabricante: 'technostore',
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
    emoji: '📱',
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
  const desired = buildDesired()
  console.log(`[samsung] Catálogo nuevo: ${desired.length} modelos (dry=${DRY})`)

  // --- Mock local ---
  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const existingSam = (mock.products || []).filter(
    p => p.categoria === 'celulares' && /SAMSUNG/i.test(String(p.nombre || '')),
  )
  console.log(`[samsung] Existentes en mock: ${existingSam.length}`)

  const { updates, news, unmappedExisting } = matchExisting(existingSam, desired)
  console.log(`[samsung] Updates: ${updates.length} | Altas: ${news.length} | Bajas (sacar del catálogo): ${unmappedExisting.length}`)
  for (const u of updates) {
    const delta = u.desired.transferencia - (u.existing.precio_transferencia || 0)
    console.log(`  ~ ${u.existing.sku} → ${u.desired.sku} | ${u.desired.nombre} | usd ${u.desired.usd} | transfer ${u.existing.precio_transferencia} → ${u.desired.transferencia} (${delta >= 0 ? '+' : ''}${delta})`)
  }
  for (const n of news) console.log(`  + ${n.sku} | ${n.nombre} | usd ${n.usd} | transfer ${n.transferencia}`)
  for (const b of unmappedExisting) console.log(`  - ${b.sku} | ${b.nombre}`)

  if (DRY) {
    console.log('[samsung] dry-run: no se escribió nada')
    return
  }

  const removeIds = new Set(unmappedExisting.map(p => String(p.id)))
  const byId = new Map(mock.products.map(p => [String(p.id), p]))

  for (const u of updates) {
    const id = String(u.existing.id)
    byId.set(id, applyToProduct(u.existing, u.desired))
  }
  for (const n of news) {
    const id = randomId()
    byId.set(id, newProduct(n, id))
  }

  // Reconstruir: mantener orden original, filtrar bajas, agregar altas al final
  const newProducts = []
  const seen = new Set()
  for (const p of mock.products) {
    const id = String(p.id)
    if (removeIds.has(id)) continue
    newProducts.push(byId.get(id) || p)
    seen.add(id)
  }
  for (const [id, p] of byId) {
    if (!seen.has(id) && p && p.categoria === 'celulares' && /Samsung/i.test(p.nombre || '')) {
      // solo altas recién creadas
      if (news.some(n => n.sku === p.sku)) newProducts.push(p)
    }
  }

  mock.products = newProducts
  fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
  console.log(`[samsung] Mock actualizado: ${mock.products.length} productos totales`)

  // --- Firestore ---
  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  const db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)

  // Indexar por sku
  const snap = await col.get()
  const bySku = new Map()
  for (const d of snap.docs) {
    const sku = String(d.data().sku || '').toUpperCase()
    if (sku) bySku.set(sku, { ref: d.ref, data: d.data() })
  }

  const now = new Date().toISOString()
  let wUpdates = 0, wCreates = 0, wDeletes = 0

  // Updates/creates por desired
  for (const d of desired) {
    const existing = bySku.get(d.sku.toUpperCase())
    // También buscar por skus viejos mapeados
    const mapped = updates.find(u => u.desired.key === d.key)
    let ref = existing?.ref
    let base = existing?.data
    if (!ref && mapped) {
      const oldSku = String(mapped.existing.sku || '').toUpperCase()
      const old = bySku.get(oldSku)
      if (old) { ref = old.ref; base = old.data }
    }
    const product = ref
      ? applyToProduct({ ...base, id: ref.id, sku: base?.sku || d.sku }, d)
      : newProduct(d, randomId())
    const { id: _drop, ...doc } = product
    if (ref) {
      await ref.set({ ...doc, updatedAt: now }, { merge: true })
      wUpdates++
    } else {
      await col.doc(String(doc.sku ? d.sku : randomId())).set({ ...doc, sku: d.sku, createdAt: now, updatedAt: now })
      wCreates++
    }
  }

  // Bajas:Samsung en Firestore que no están en desired (por sku nuevo ni por mapeo)
  const desiredSkus = new Set(desired.map(d => d.sku.toUpperCase()))
  const mappedOldSkus = new Set(updates.map(u => String(u.existing.sku || '').toUpperCase()))
  for (const [sku, entry] of bySku) {
    const data = entry.data
    if (data.categoria !== 'celulares') continue
    if (!/SAMSUNG/i.test(String(data.nombre || ''))) continue
    if (desiredSkus.has(sku)) continue
    if (mappedOldSkus.has(sku)) continue
    // Es un Samsung viejo no presente en el nuevo listado
    await entry.ref.delete()
    wDeletes++
    console.log(`  firestore delete: ${sku} | ${data.nombre}`)
  }

  console.log(`[samsung] Firestore: ${wUpdates} updates, ${wCreates} creates, ${wDeletes} deletes`)
}

main().catch(e => {
  console.error('[samsung] Fatal:', e)
  process.exit(1)
})
