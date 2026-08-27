/**
 * server/migrate-to-firestore.mjs — Migración UNA vez de SQLite -> Firestore.
 *
 * Lee technova.db (node:sqlite) y vuelca:
 *   - products      -> colección "productos"   (doc id = p{id}, sku = LEGACY-{id})
 *   - orders+items  -> colección "pedidos"      (doc id = o{id}, items anidados)
 * No borra el SQLite original; solo copia. Es idempotente salvo que ya existan
 * datos (usá FORCE=1 para sobrescribir).
 *
 * Requiere Firebase configurado (emulador o credenciales). Ver README.md.
 */
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getFirestoreDb, COLLECTIONS } from './firebase.js'
import { productToDoc } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'technova.db')
const FORCE = process.env.FORCE === '1'

const sqlite = new DatabaseSync(dbPath)
const fs = getFirestoreDb()
const { PRODUCTS, ORDERS } = COLLECTIONS

function rowToApiProduct(r) {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    price: r.price,
    oldPrice: r.old_price ?? undefined,
    rating: r.rating,
    reviews: r.reviews,
    stock: r.stock,
    badge: r.badge ?? undefined,
    emoji: r.emoji,
    specs: JSON.parse(r.specs || '[]'),
    active: !!r.active,
    vram: r.vram ?? null,
    cuda: r.cuda ?? null,
    tflops: r.tflops ?? null,
    frameworks: JSON.parse(r.frameworks || '[]'),
    image: r.image ?? null,
  }
}

async function main() {
  const existingProducts = await fs.collection(PRODUCTS).limit(1).get()
  if (!existingProducts.empty && !FORCE) {
    console.error('[migrate] Ya existen productos en Firestore. Abortando (usá FORCE=1 para sobrescribir).')
    process.exit(1)
  }

  const products = sqlite.prepare('SELECT * FROM products ORDER BY id').all()
  console.log(`[migrate] ${products.length} productos en SQLite`)

  let pCount = 0
  for (const r of products) {
    const api = rowToApiProduct(r)
    const doc = productToDoc(api)
    doc.sku = `LEGACY-${r.id}`
    doc.legacyId = r.id
    await fs.collection(PRODUCTS).doc(`p${r.id}`).set(doc)
    pCount++
  }
  console.log(`[migrate] ✔ ${pCount} productos migrados a "productos"`)

  const orders = sqlite.prepare('SELECT * FROM orders ORDER BY id').all()
  console.log(`[migrate] ${orders.length} pedidos en SQLite`)

  let oCount = 0
  for (const o of orders) {
    const items = sqlite.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id)
    const nested = items.map((it) => ({
      producto_id: `p${it.product_id}`,
      nombre: it.name,
      emoji: it.emoji,
      qty: it.qty,
      precio_unitario: it.unit_price,
    }))
    await fs.collection(ORDERS).doc(`o${o.id}`).set({
      code: o.code,
      customer_name: o.customer_name,
      email: o.email,
      phone: o.phone,
      city: o.city,
      address: o.address,
      payment_method: o.payment_method,
      subtotal: o.subtotal,
      shipping: o.shipping,
      total: o.total,
      status: o.status,
      created_at: o.created_at,
      legacyId: o.id,
      items: nested,
    })
    oCount++
  }
  console.log(`[migrate] ✔ ${oCount} pedidos migrados a "pedidos"`)

  console.log('[migrate] Listo. El archivo technova.db NO fue borrado.')
}

main().catch((e) => {
  console.error('[migrate] Error:', e.message)
  process.exit(1)
})
