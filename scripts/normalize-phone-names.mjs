/**
 * Limpia los nombres de los celulares nuevos.
 *
 * Uso:
 *   node scripts/normalize-phone-names.mjs --dry-run
 *   node scripts/normalize-phone-names.mjs
 *
 * Qué hace:
 *  - Saca el sufijo "- U$S" y "(Sin fuente)".
 *  - Agrega la marca al principio (Xiaomi / Samsung / Motorola / Apple).
 *  - Pone los modelos en formato lindo (Redmi Note 14S, Poco F5, Mi 12 Lite...).
 *  - Ordena capacidad + RAM: "4GB 128GB" -> "128GB 4GB RAM".
 *  - Actualiza marca real (Xiaomi/Samsung/Motorola/Apple) para los filtros.
 *  - No toca precios, stock, visibilidad ni SKUs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const DRY = process.argv.includes('--dry-run')
const now = new Date().toISOString()

import { cleanPhoneName, brandOfSku } from '../server/phone-names.js'

/* ---------------- Mock ---------------- */
const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
const mockPhones = (mock.products || []).filter(p => String(p.categoria || '').toLowerCase() === 'celulares' && p.condicion !== 'usado')

/* ---------------- Firestore ---------------- */
const LOCAL = process.argv.includes('--local')
let fsPhones = []
let db = null
if (!LOCAL) {
  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)
  // Solo leemos celulares (233 docs) para cuidar la cuota de Firestore.
  const snap = await col.where('categoria', '==', 'celulares').get()
  fsPhones = snap.docs
    .map(d => ({ ref: d.ref, id: d.id, data: d.data() }))
    .filter(d => d.data.condicion !== 'usado')
}

console.log(`[nombres] mock: ${mockPhones.length} celulares | firestore: ${LOCAL ? 'omitido (--local)' : fsPhones.length + ' celulares'}`)

const changes = []
const source = LOCAL ? mockPhones.map(p => ({ ref: null, data: p })) : fsPhones
for (const d of source) {
  const oldName = String(d.data.nombre || d.data.name || '')
  const newName = cleanPhoneName(oldName, d.data.sku)
  const brand = brandOfSku(d.data.sku)
  const oldBrand = String(d.data.marca || '')
  if (newName !== oldName || (brand && brand !== oldBrand)) {
    changes.push({ sku: d.data.sku, oldName, newName, oldBrand, newBrand: brand || oldBrand, ref: d.ref })
  }
}

console.log(`[nombres] cambios: ${changes.length}`)
const limit = process.argv.includes('--all') ? changes.length : 15
for (const c of changes.slice(0, limit)) {
  console.log(`  ${c.sku}`)
  console.log(`    antes: ${c.oldName}`)
  console.log(`    ahora: ${c.newName}  [marca: ${c.oldBrand} -> ${c.newBrand}]`)
}
if (changes.length > limit) console.log(`  ... y ${changes.length - limit} más`)

const unchanged = changes.filter(c => c.oldName === c.newName && c.oldBrand === c.newBrand).length
const suspicious = changes.filter(c => !c.newName || c.newName.length < 6)
if (suspicious.length) {
  console.log('[nombres] OJO, nombres sospechosos:')
  for (const s of suspicious) console.log(`  ${s.sku}: "${s.oldName}" -> "${s.newName}"`)
}

if (DRY) {
  console.log('[nombres] dry-run: no se escribió nada')
  process.exit(0)
}

/* Aplicar en Firestore primero (si falla, no tocamos el mock) */
if (!LOCAL) {
  const CHUNK = 400
  const ops = changes.map(c => {
    const data = { nombre: c.newName, name: c.newName, updatedAt: now }
    if (c.newBrand) { data.marca = c.newBrand; data.brand = c.newBrand; data.fabricante = c.newBrand }
    return { ref: c.ref, data }
  })
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch()
    for (const op of ops.slice(i, i + CHUNK)) batch.set(op.ref, op.data, { merge: true })
    await batch.commit()
  }
  console.log(`[nombres] firestore actualizado: ${ops.length}`)
}

/* Aplicar en mock */
const mockBySku = new Map()
for (const p of (mock.products || [])) {
  const k = String(p.sku || '').toUpperCase()
  if (k && !mockBySku.has(k)) mockBySku.set(k, p)
}
let mockUpdates = 0
for (const c of changes) {
  const p = mockBySku.get(String(c.sku || '').toUpperCase())
  if (!p) continue
  p.nombre = c.newName
  p.name = c.newName
  if (c.newBrand) { p.marca = c.newBrand; p.brand = c.newBrand; p.fabricante = c.newBrand }
  p.updatedAt = now
  mockUpdates++
}
fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
console.log(`[nombres] mock actualizado: ${mockUpdates}`)
console.log('[nombres] OK')
