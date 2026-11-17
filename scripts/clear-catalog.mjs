/**
 * Vacia el catálogo de productos (TechnoStore + FuturoHard).
 *
 * ATENCIÓN: borra definitivamente los documentos de Firestore. Requiere --yes.
 * Antes de ejecutarlo, corré scripts/backup-products.mjs si querés guardar una copia.
 *
 * Uso:
 *   node scripts/clear-catalog.mjs --dry-run
 *   node scripts/clear-catalog.mjs --yes
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const YES = process.argv.includes('--yes')
const DRY = process.argv.includes('--dry-run')

if (!YES && !DRY) {
  console.error('[clear] Para borrar los productos pasá --yes (o --dry-run para solo ver el conteo).')
  process.exit(1)
}

const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
const db = getFirestoreDb()
const col = db.collection(COLLECTIONS.PRODUCTS)
const snap = await col.get()
const refs = snap.docs.map(d => d.ref)
console.log(`[clear] Firestore: ${refs.length} productos`)

const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
console.log(`[clear] Mock: ${(mock.products || []).length} productos`)

if (DRY) {
  console.log('[clear] dry-run: no se borró nada')
  process.exit(0)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
let deleted = 0
const CHUNK = 450
for (let i = 0; i < refs.length; i += CHUNK) {
  const chunk = refs.slice(i, i + CHUNK)
  let done = false
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    try {
      const batch = db.batch()
      for (const ref of chunk) batch.delete(ref)
      await batch.commit()
      deleted += chunk.length
      done = true
    } catch (e) {
      console.warn(`[clear] lote ${i / CHUNK + 1} intento ${attempt}: ${e.message}`)
      await sleep(1500 * attempt)
    }
  }
  if (!done) throw new Error(`No se pudo borrar el lote que empieza en ${i}`)
}

const after = await col.get()
console.log(`[clear] Firestore: ${deleted} borrados | quedan ${after.size}`)

mock.products = []
fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
console.log('[clear] Mock: productos vaciado')
console.log('[clear] OK')
