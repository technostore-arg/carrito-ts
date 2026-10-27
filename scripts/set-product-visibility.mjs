/**
 * Curaduría de catálogo: visibilidad en tienda (mock + Firestore).
 *
 * El campo `visibleEnTienda` controla qué se publica en technostore.ar /
 * ia.technostore.ar. Los productos ocultos NO se borran: siguen en Firestore
 * (stock, precios, historial) y se ven en el admin (que pide incluirOcultos=1).
 *
 * Uso:
 *   node scripts/set-product-visibility.mjs --hide-all [--dry-run]
 *   node scripts/set-product-visibility.mjs --show-all [--dry-run]
 *   node scripts/set-product-visibility.mjs --show SKU1,SKU2,SKU3 [--dry-run]
 *   node scripts/set-product-visibility.mjs --hide SKU1,SKU2 [--dry-run]
 *   node scripts/set-product-visibility.mjs --show-file ruta/lista.txt [--dry-run]
 *
 * La lista del archivo acepta un SKU por línea (o un nombre exacto).
 * Ignora líneas vacías y las que empiezan con #.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const DRY = process.argv.includes('--dry-run')

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}
function argList(flag) {
  const v = argValue(flag)
  return v ? v.split(',').map(s => s.trim()).filter(Boolean) : []
}

const HIDE_ALL = process.argv.includes('--hide-all')
const SHOW_ALL = process.argv.includes('--show-all')
const SHOW = argList('--show')
const HIDE = argList('--hide')
const SHOW_FILE = argValue('--show-file')

function readListFile(file) {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  const txt = fs.readFileSync(abs, 'utf8')
  return txt
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

let showTargets = [...SHOW]
if (SHOW_FILE) showTargets = [...showTargets, ...readListFile(SHOW_FILE)]

const modes = [HIDE_ALL, SHOW_ALL, showTargets.length > 0, HIDE.length > 0].filter(Boolean)
if (modes.length !== 1) {
  console.error('[visibilidad] Indicá exactamente un modo: --hide-all | --show-all | --show SKU,... | --hide SKU,... | --show-file archivo')
  process.exit(1)
}

const targetVisible = SHOW_ALL || showTargets.length > 0
const targets = SHOW_ALL || HIDE_ALL ? null : targetVisible ? showTargets : HIDE
const targetSet = targets ? new Set(targets.map(s => s.toUpperCase())) : null

function norm(v) { return String(v || '').trim().toUpperCase() }

console.log(`[visibilidad] modo=${HIDE_ALL ? 'ocultar todo' : SHOW_ALL ? 'mostrar todo' : targetVisible ? 'mostrar SKUs' : 'ocultar SKUs'}${DRY ? ' (dry-run)' : ''}`)

/* ---------------- Mock ---------------- */
const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
const products = mock.products || []

// Resolución de targets: SKU exacto primero; si no, nombre exacto (case-insensitive).
const skuIndex = new Map()
const nameIndex = new Map()
for (const p of products) {
  const sku = norm(p.sku)
  if (sku) skuIndex.set(sku, p)
  const nombre = norm(p.nombre || p.name)
  if (nombre) {
    if (!nameIndex.has(nombre)) nameIndex.set(nombre, [])
    nameIndex.get(nombre).push(p)
  }
}

const resolved = new Map() // id -> product
const notFound = []
if (targets) {
  for (const t of targets) {
    const bySku = skuIndex.get(norm(t))
    if (bySku) { resolved.set(String(bySku.id), bySku); continue }
    const byName = nameIndex.get(norm(t)) || []
    if (byName.length === 1) { resolved.set(String(byName[0].id), byName[0]); continue }
    if (byName.length > 1) {
      console.warn(`  ! "${t}" coincide con ${byName.length} productos (${byName.map(p => p.sku).join(', ')}) — usá SKU`)
      continue
    }
    notFound.push(t)
  }
  if (notFound.length) console.warn(`  ! no encontrados: ${notFound.join(', ')}`)
}

let mockChanged = 0
if (!targets) {
  for (const p of products) {
    const next = targetVisible
    if ((p.visibleEnTienda !== false) !== next) { p.visibleEnTienda = next; mockChanged++ }
    else p.visibleEnTienda = next
  }
} else {
  for (const p of resolved.values()) {
    if ((p.visibleEnTienda !== false) !== targetVisible) { p.visibleEnTienda = targetVisible; mockChanged++ }
    else p.visibleEnTienda = targetVisible
  }
}

const mockVisible = products.filter(p => p.visibleEnTienda !== false).length
console.log(`[visibilidad] mock: ${products.length} productos · ${mockVisible} quedarán visibles · ${products.length - mockVisible} ocultos · cambios ${mockChanged}`)
if (targets && targets.length) {
  console.log(`[visibilidad] targets resueltos: ${resolved.size}/${targets.length}`)
  for (const p of resolved.values()) {
    const inactive = p.active === false || p.estado === 'pausado' || p.estado === 'agotado'
    const noStock = p.tipo_venta !== 'encargo' && !(Number(p.stock) > 0)
    if (targetVisible && (inactive || noStock)) {
      console.warn(`  ! ${p.sku} queda visible pero ${inactive ? 'está pausado/agotado' : 'sin stock'} — no se mostrará igual`)
    }
  }
}

if (DRY) {
  console.log('[visibilidad] dry-run: no se escribió nada')
  process.exit(0)
}

fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))

/* ---------------- Firestore ---------------- */
const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
const db = getFirestoreDb()
const col = db.collection(COLLECTIONS.PRODUCTS)
const snap = await col.get()

const now = new Date().toISOString()
const ops = []
if (!targets) {
  for (const doc of snap.docs) {
    const data = doc.data()
    const current = data.visibleEnTienda !== false
    if (current !== targetVisible) ops.push({ ref: doc.ref, visible: targetVisible })
  }
} else {
  const bySku = new Map()
  const byName = new Map()
  for (const doc of snap.docs) {
    const data = doc.data()
    const sku = norm(data.sku)
    if (sku) bySku.set(sku, doc)
    const nombre = norm(data.nombre || data.name)
    if (nombre) {
      if (!byName.has(nombre)) byName.set(nombre, [])
      byName.get(nombre).push(doc)
    }
  }
  const seen = new Set()
  for (const t of targets) {
    const doc = bySku.get(norm(t)) || (byName.get(norm(t))?.length === 1 ? byName.get(norm(t))[0] : null)
    if (!doc || seen.has(doc.id)) continue
    seen.add(doc.id)
    if ((doc.data().visibleEnTienda !== false) !== targetVisible) ops.push({ ref: doc.ref, visible: targetVisible })
  }
  console.log(`[visibilidad] firestore: ${seen.size}/${targets.length} targets encontrados`)
}

const CHUNK = 400
for (let i = 0; i < ops.length; i += CHUNK) {
  const batch = db.batch()
  for (const op of ops.slice(i, i + CHUNK)) {
    batch.set(op.ref, { visibleEnTienda: op.visible, updatedAt: now }, { merge: true })
  }
  await batch.commit()
}

const changed = new Map(ops.map(op => [op.ref.id, op.visible]))
let visibleAfter = 0
for (const doc of snap.docs) {
  const nowVisible = changed.has(doc.id) ? changed.get(doc.id) : doc.data().visibleEnTienda !== false
  if (nowVisible) visibleAfter++
}
console.log(`[visibilidad] firestore: ${ops.length} docs actualizados`)
console.log(`[visibilidad] estado final firestore: ${visibleAfter} visibles / ${snap.docs.length} total`)
console.log('[visibilidad] OK')
