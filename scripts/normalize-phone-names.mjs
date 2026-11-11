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

const BRAND_BY_SKU = [
  [/^IPH-/, 'Apple'],
  [/^MOT-/, 'Motorola'],
  [/^SAM-/, 'Samsung'],
  [/^TXT-(MI|NOTE|REDMI|POCO|MIXFLIP|XIAOMI)/, 'Xiaomi'],
]

const ACRONYMS = new Set(['5G', '4G', 'LTE', 'GT', 'FE', 'RAM', 'ROM', 'SIM', 'NFC', 'USB', 'AI', 'NFC'])
const KEEP_LOWER = {
  pro: 'Pro', max: 'Max', plus: 'Plus', ultra: 'Ultra', lite: 'Lite', neo: 'Neo',
  power: 'Power', fusion: 'Fusion', core: 'Core', edge: 'Edge', note: 'Note',
  flip: 'Flip', fold: 'Fold', galaxy: 'Galaxy', leica: 'Leica', dual: 'Dual',
  sin: 'Sin', cargador: 'Cargador',
}

function titleWord(w) {
  if (!w) return w
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase()
  if (/^iphone$/i.test(w)) return 'iPhone'
  // Códigos de modelo: A03, E13, G04S, X3, Z8, 14S, 15C, 1TB, 512GB, 5G...
  if (/^[A-Z]\d/i.test(w) || /^\d/.test(w)) return w.toUpperCase()
  if (/^[A-Z]$/.test(w)) return w
  const lower = w.toLowerCase()
  if (KEEP_LOWER[lower]) return KEEP_LOWER[lower]
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function titleCase(text) {
  return text.split('/').map(part => part.split(/\s+/).map(titleWord).join(' ')).join('/')
}

function brandOf(sku) {
  const up = String(sku || '').toUpperCase()
  for (const [re, brand] of BRAND_BY_SKU) if (re.test(up)) return brand
  return null
}

function cleanName(raw, sku) {
  let n = String(raw || '').trim()
  // Basura de importación
  n = n.replace(/\s*-\s*U\$S\s*$/i, '')
  n = n.replace(/\s*-\s*U\$S\s*/gi, ' ')
  n = n.replace(/\s*\(sin\s+fuente\)\s*/gi, ' ')
  n = n.replace(/\s+/g, ' ').trim()

  const brand = brandOf(sku)
  const up = String(sku || '').toUpperCase()

  let prefix = ''
  if (brand === 'Xiaomi') {
    if (/^TXT-NOTE/.test(up)) { prefix = 'Xiaomi Redmi Note '; n = n.replace(/^NOTE\s+/i, '') }
    else if (/^TXT-REDMI/.test(up)) { prefix = 'Xiaomi Redmi '; n = n.replace(/^REDMI\s+/i, '') }
    else if (/^TXT-POCO/.test(up)) { prefix = 'Xiaomi Poco '; n = n.replace(/^POCO\s+/i, '') }
    else if (/^TXT-MIXFLIP/.test(up)) { prefix = 'Xiaomi Mix Flip '; n = n.replace(/^MIX\s+FLIP\s+/i, '') }
    else if (/^TXT-MI/.test(up)) { prefix = 'Xiaomi Mi '; n = n.replace(/^MI\s+/i, '') }
    else { prefix = 'Xiaomi '; n = n.replace(/^XIAOMI\s+/i, '') }
  } else if (brand === 'Motorola') {
    prefix = 'Motorola '
    n = n.replace(/^MOTOROLA\s+/i, '')
  } else if (brand === 'Samsung') {
    prefix = 'Samsung '
    n = n.replace(/^SAMSUNG\s+/i, '')
  } else if (brand === 'Apple') {
    n = n.replace(/^iphone/i, 'iPhone')
  }

  // Orden capacidad + RAM: "4GB 128GB" -> "128GB 4GB RAM"
  n = n.replace(/(\d+(?:\.\d+)?(?:GB|TB))\s+(\d+(?:\.\d+)?(?:GB|TB))(?!\s*RAM)/i, (m, a, b) => {
    const num = s => parseFloat(s)
    const toGb = s => /TB/i.test(s) ? num(s) * 1024 : num(s)
    if (toGb(a) < toGb(b)) return `${b} ${a} RAM`
    return m
  })

  n = titleCase(n).replace(/\s+/g, ' ').trim()
  // Variantes entre paréntesis: "(black, Blue)" -> "(Black, Blue)"
  n = n.replace(/\(([^)]*)\)/g, (m, inner) => `(${inner.split(',').map(s => titleCase(s.trim())).join(', ')})`)

  if (brand === 'Apple') {
    n = n.replace(/^iphone/i, 'iPhone')
    n = n.replace(/^(iPhone\s+\d+)E\b/, '$1e')
    return n
  }
  if (brand === 'Samsung' && !/^Galaxy\s/i.test(n)) return `${prefix}Galaxy ${n}`
  return `${prefix}${n}`.trim()
}

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
  const newName = cleanName(oldName, d.data.sku)
  const brand = brandOf(d.data.sku)
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
