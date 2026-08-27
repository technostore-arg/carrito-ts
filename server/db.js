/**
 * server/db.js — Capa de acceso a datos sobre Firestore.
 *
 * Reemplaza la capa SQLite manteniendo la MISMA forma de los objetos que
 * consumen los frontends y el admin (GET /api/products, /api/orders, etc.),
 * para no reescribir componentes React.
 *
 * Colecciones:
 *   - productos  (según packages/catalog-schema)
 *   - pedidos    (compras directas)
 *   - consultas  (registros de "encargo" vía WhatsApp)
 *   - mp_payments (auditoría de MercadoPago)
 */
import { randomBytes } from 'node:crypto'
import { getFirestoreDb, COLLECTIONS, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from './firebase.js'

const { PRODUCTS, ORDERS, CONSULTAS, MP_PAYMENTS } = COLLECTIONS

/* ---------------- Traducción doc <-> forma API ---------------- */

// Firestore doc -> objeto que devuelve la API (forma legacy, estable)
export function docToProduct(doc) {
  const d = doc.data()
  return {
    id: doc.id,
    name: d.name,
    brand: d.brand ?? d.fabricante ?? '',
    category: d.category ?? d.categoria ?? '',
    price: d.price ?? d.precio ?? 0,
    oldPrice: d.oldPrice ?? undefined,
    rating: d.rating ?? 4.5,
    reviews: d.reviews ?? 0,
    stock: d.stock ?? 0,
    badge: d.badge ?? undefined,
    emoji: d.emoji ?? '📦',
    specs: Array.isArray(d.specs)
      ? d.specs
      : d.especificaciones && typeof d.especificaciones === 'object'
        ? Object.values(d.especificaciones)
        : [],
    active: d.active === undefined ? d.estado !== 'pausado' && d.estado !== 'agotado' : !!d.active,
    vram: d.vram ?? null,
    cuda: d.cuda ?? null,
    tflops: d.tflops ?? null,
    frameworks: Array.isArray(d.frameworks) ? d.frameworks : [],
    image: d.image ?? (Array.isArray(d.imagenes) ? d.imagenes[0] : null),
  }
}

// Objeto de entrada (API/form) -> doc Firestore (incluye campos canonical del schema)
export function productToDoc(p) {
  return {
    name: String(p.name ?? '').trim(),
    brand: String(p.brand ?? '').trim(),
    fabricante: String(p.brand ?? '').trim(), // manufacturer en schema
    categoria: String(p.category ?? '').trim().toLowerCase(),
    category: String(p.category ?? '').trim().toLowerCase(),
    price: Number(p.price) || 0,
    oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    rating: Number(p.rating) || 4.5,
    reviews: Number(p.reviews) || 0,
    stock: Number(p.stock) || 0,
    badge: p.badge || null,
    emoji: p.emoji || '📦',
    specs: Array.isArray(p.specs) ? p.specs : [],
    active: p.active === undefined ? true : !!p.active,
    vram: p.vram ?? null,
    cuda: p.cuda ?? null,
    tflops: p.tflops ?? null,
    frameworks: Array.isArray(p.frameworks) ? p.frameworks : [],
    image: p.image || null,
    // Campos canonical (packages/catalog-schema)
    sku: p.sku ? String(p.sku).toUpperCase() : `TS-${(String(p.name || 'X').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}`,
    marca: p.marca || 'technostore',
    tipo_venta: p.tipo_venta || 'directa',
    moneda: p.moneda || 'ARS',
    estado: p.estado || 'activo',
    fuente_origen: p.fuente_origen || 'manual',
  }
}

/* ---------------- Productos ---------------- */

export async function getProducts({ activeOnly = true } = {}) {
  const db = getFirestoreDb()
  let q = db.collection(PRODUCTS)
  if (activeOnly) q = q.where('active', '==', true)
  const snap = await q.get()
  return snap.docs.map(docToProduct)
}

export async function getProductById(id) {
  const db = getFirestoreDb()
  const doc = await db.collection(PRODUCTS).doc(String(id)).get()
  if (!doc.exists) return null
  return docToProduct(doc)
}

export async function createProduct(data) {
  const db = getFirestoreDb()
  const ref = await db.collection(PRODUCTS).add({
    ...productToDoc(data),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return docToProduct(await ref.get())
}

export async function updateProduct(id, data) {
  const db = getFirestoreDb()
  const ref = db.collection(PRODUCTS).doc(String(id))
  const existing = await ref.get()
  if (!existing.exists) return null
  const merged = { ...docToProduct(existing), ...data }
  await ref.set({ ...productToDoc(merged), updatedAt: new Date().toISOString() })
  return docToProduct(await ref.get())
}

export async function deleteProduct(id) {
  const db = getFirestoreDb()
  const ref = db.collection(PRODUCTS).doc(String(id))
  const existing = await ref.get()
  if (!existing.exists) return false
  await ref.delete()
  return true
}

/* ---------------- Pedidos ---------------- */

export async function createOrder({ customer, items }) {
  const db = getFirestoreDb()
  const code = `TS-${randomBytes(3).toString('hex').toUpperCase()}`

  return db.runTransaction(async (tx) => {
    let subtotal = 0
    const resolved = []
    for (const it of items) {
      const ref = db.collection(PRODUCTS).doc(String(it.id))
      const snap = await tx.get(ref)
      if (!snap.exists) throw new Error(`Producto ${it.id} inexistente`)
      const p = docToProduct(snap)
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1))
      if (qty > (p.stock || 0)) {
        throw new Error(`Stock insuficiente de "${p.name}" (${p.stock} disponibles)`)
      }
      resolved.push({ producto_id: p.id, nombre: p.name, emoji: p.emoji, qty, precio_unitario: p.price })
      tx.update(ref, { stock: (p.stock - qty) })
    }

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
    const total = subtotal + shipping
    const orderDoc = {
      code,
      customer_name: customer.name?.trim(),
      email: customer.email?.trim(),
      phone: customer.phone || '',
      city: customer.city || '',
      address: customer.address || '',
      payment_method: ['mercadopago', 'transferencia', 'tarjeta'].includes(customer.paymentMethod)
        ? customer.paymentMethod
        : 'mercadopago',
      subtotal,
      shipping,
      total,
      status: 'pendiente',
      created_at: new Date().toISOString(),
      items: resolved,
    }
    const ref = db.collection(ORDERS).doc()
    tx.set(ref, orderDoc)
    return { code, total }
  })
}

export async function getOrders({ status } = {}) {
  const db = getFirestoreDb()
  let q = db.collection(ORDERS)
  if (status) q = q.where('status', '==', status)
  const snap = await q.get()
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  // Ordenar en memoria para evitar índice compuesto (status + created_at) en Firestore
  rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return rows
}

export async function getOrderById(id) {
  const db = getFirestoreDb()
  const doc = await db.collection(ORDERS).doc(String(id)).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() }
}

export async function getOrderByCode(code) {
  const db = getFirestoreDb()
  const snap = await db.collection(ORDERS).where('code', '==', code).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function updateOrderStatus(id, status) {
  const db = getFirestoreDb()
  const ref = db.collection(ORDERS).doc(String(id))
  const existing = await ref.get()
  if (!existing.exists) return false
  await ref.update({ status })
  return true
}

export async function updateOrderStatusByCode(code, status) {
  const order = await getOrderByCode(code)
  if (!order) return false
  return updateOrderStatus(order.id, status)
}

/* ---------------- MercadoPago ---------------- */

export async function logMpPayment({ code, preferenceId, payload }) {
  const db = getFirestoreDb()
  await db.collection(MP_PAYMENTS).add({
    order_code: code,
    preference_id: preferenceId ?? null,
    payload,
    created_at: new Date().toISOString(),
  })
}

/* ---------------- Consultas (encargo WhatsApp) ---------------- */

export async function createConsulta({ sku, nombre, marca, telefono, mensaje, origen = 'whatsapp' }) {
  const db = getFirestoreDb()
  const ref = await db.collection(CONSULTAS).add({
    sku: sku || null,
    nombre: nombre || null,
    marca: marca || null,
    telefono: telefono || '',
    mensaje: mensaje || '',
    origen,
    createdAt: new Date().toISOString(),
  })
  return ref.id
}
