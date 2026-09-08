/**
 * server/migrate-mock-to-firestore.mjs — Migración UNA vez de .mock-data.json -> Firestore.
 *
 * A diferencia de migrate-to-firestore.mjs (que lee el SQLite viejo technova.db
 * con 24 productos rancios), este vuelca el catálogo REAL que sirve el mock:
 *   - products  -> colección "productos"  (doc id = mock id, normalizado con productToDoc)
 *   - orders    -> colección "pedidos"    (doc id = mock id, tal cual)
 *   - consultas -> colección "consultas"  (doc id = mock id, tal cual)
 * No borra el .mock-data.json original; solo copia. Idempotente salvo que ya
 * existan datos (usá FORCE=1 para sobrescribir).
 *
 * Requiere Firebase configurado (emulador o credenciales). Ver README.md.
 *   $env:FIREBASE_PROJECT_ID="..."; $env:FIREBASE_CLIENT_EMAIL="..."; $env:FIREBASE_PRIVATE_KEY="..."
 *   node server/migrate-mock-to-firestore.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import { getFirestoreDb, COLLECTIONS } from './firebase.js'
import { productToDoc } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mockPath = path.join(__dirname, '.mock-data.json')
const FORCE = process.env.FORCE === '1'

if (!existsSync(mockPath)) {
  console.error(`[migrate-mock] No existe ${mockPath}. Nada que migrar.`)
  process.exit(1)
}

const db = getFirestoreDb()
const { PRODUCTS, ORDERS, CONSULTAS } = COLLECTIONS

async function chunkedWrite(pairs) {
  // pairs: [[ref, data], ...] — Firestore limita a 500 writes por batch
  for (let i = 0; i < pairs.length; i += 450) {
    const batch = db.batch()
    for (const [ref, data] of pairs.slice(i, i + 450)) batch.set(ref, data)
    await batch.commit()
    console.log(`[migrate-mock]   lote ${Math.floor(i / 450) + 1}: ${Math.min(i + 450, pairs.length)}/${pairs.length}`)
  }
}

async function main() {
  const mock = JSON.parse(readFileSync(mockPath, 'utf-8'))
  const products = mock.products || []
  const orders = mock.orders || []
  const consultas = mock.consultas || []
  console.log(`[migrate-mock] Mock local: ${products.length} productos, ${orders.length} pedidos, ${consultas.length} consultas`)

  const existing = await db.collection(PRODUCTS).limit(1).get()
  if (!existing.empty && !FORCE) {
    console.error('[migrate-mock] Ya existen productos en Firestore. Abortando (usá FORCE=1 para sobrescribir).')
    process.exit(1)
  }

  const now = new Date().toISOString()
  const productPairs = products.map((p) => [
    db.collection(PRODUCTS).doc(String(p.id)),
    { ...productToDoc(p), createdAt: p.createdAt || now, updatedAt: now },
  ])
  await chunkedWrite(productPairs)
  console.log(`[migrate-mock] ✔ ${productPairs.length} productos migrados a "productos"`)

  const stripId = (o) => { const { id, ...rest } = o; return rest }
  const orderPairs = orders.map((o) => [db.collection(ORDERS).doc(String(o.id)), stripId(o)])
  if (orderPairs.length) await chunkedWrite(orderPairs)
  console.log(`[migrate-mock] ✔ ${orderPairs.length} pedidos migrados a "pedidos"`)

  const consultaPairs = consultas.map((c) => [db.collection(CONSULTAS).doc(String(c.id)), stripId(c)])
  if (consultaPairs.length) await chunkedWrite(consultaPairs)
  console.log(`[migrate-mock] ✔ ${consultaPairs.length} consultas migradas a "consultas"`)

  console.log('[migrate-mock] Listo. El archivo .mock-data.json NO fue borrado.')
}

main().catch((e) => {
  console.error('[migrate-mock] Error:', e.message)
  process.exit(1)
})
