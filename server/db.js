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
import { mockStore, resolveCategoryImage } from './mock-store.js'

const { PRODUCTS, ORDERS, CONSULTAS, MP_PAYMENTS } = COLLECTIONS

function useMock(err) {
  return err && String(err.message || '').includes('FIREBASE_NO_CONFIG')
}

/* ---------------- Traducción doc <-> forma API ---------------- */

// Firestore doc -> objeto que devuelve la API (forma bilingüe: legacy EN + ES).
// Los frontends consumen los campos ES (nombre, marca, precio_transferencia,
// imagenes, especificaciones, tipo_venta...), así que se pasan tal cual.
export function docToProduct(doc) {
  const d = doc.data()
  const rawImagenes = Array.isArray(d.imagenes) ? d.imagenes : d.image ? [d.image] : []
  const imagenes = resolveCategoryImage(rawImagenes, d.categoria ?? d.category ?? '', d.nombre ?? d.name ?? '')
  return {
    id: doc.id,
    name: d.name ?? d.nombre ?? '',
    nombre: d.nombre ?? d.name ?? '',
    brand: d.brand ?? d.fabricante ?? d.marca ?? '',
    marca: d.marca ?? d.brand ?? 'technostore',
    category: d.category ?? d.categoria ?? '',
    categoria: String(d.categoria ?? d.category ?? '').toLowerCase(),
    price: d.price ?? d.precio ?? 0,
    precio: d.precio ?? d.price ?? 0,
    precio_transferencia: d.precio_transferencia ?? d.precio ?? d.price ?? 0,
    precio_mercadopago: d.precio_mercadopago ?? d.precio ?? d.price ?? 0,
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
    especificaciones: d.especificaciones && typeof d.especificaciones === 'object' ? d.especificaciones : {},
    active: d.active === undefined ? d.estado !== 'pausado' && d.estado !== 'agotado' : !!d.active,
    estado: d.estado ?? 'activo',
    vram: d.vram ?? null,
    cuda: d.cuda ?? null,
    tflops: d.tflops ?? null,
    frameworks: Array.isArray(d.frameworks) ? d.frameworks : [],
    image: imagenes[0] ?? d.image ?? null,
    imagenes,
    descripcion: d.descripcion ?? d.description ?? '',
    description: d.description ?? d.descripcion ?? '',
    sku: d.sku ? String(d.sku).toUpperCase() : '',
    tipo_venta: d.tipo_venta ?? 'directa',
    moneda: d.moneda ?? 'ARS',
    subcategoria: d.subcategoria ?? '',
    fuente_origen: d.fuente_origen ?? 'manual',
  }
}

// Objeto de entrada (API/form, forma EN o ES) -> doc Firestore (canonical + ES)
export function productToDoc(p) {
  const nombre = String(p.nombre ?? p.name ?? '').trim()
  const marca = String(p.marca ?? p.brand ?? '').trim()
  const categoria = String(p.categoria ?? p.category ?? '').trim().toLowerCase()
  const precio = Number(p.precio ?? p.price) || 0
  return {
    name: nombre,
    nombre,
    brand: marca,
    fabricante: marca, // manufacturer en schema
    marca: marca || 'technostore',
    categoria,
    category: categoria,
    price: precio,
    precio,
    precio_transferencia: Number(p.precio_transferencia ?? precio) || 0,
    precio_mercadopago: Number(p.precio_mercadopago ?? precio) || 0,
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
    image: p.image || (Array.isArray(p.imagenes) ? p.imagenes[0] : null),
    imagenes: Array.isArray(p.imagenes) ? p.imagenes : p.image ? [p.image] : [],
    descripcion: String(p.descripcion ?? p.description ?? ''),
    description: String(p.description ?? p.descripcion ?? ''),
    especificaciones: p.especificaciones && typeof p.especificaciones === 'object' ? p.especificaciones : {},
    subcategoria: p.subcategoria || '',
    // Campos canonical (packages/catalog-schema)
    sku: p.sku ? String(p.sku).toUpperCase() : `TS-${(nombre || 'X').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
    marca: marca || 'technostore',
    tipo_venta: p.tipo_venta || 'directa',
    moneda: p.moneda || 'ARS',
    estado: p.estado || 'activo',
    active: p.active === undefined ? (p.estado || 'activo') !== 'pausado' && (p.estado || 'activo') !== 'agotado' : !!p.active,
    fuente_origen: p.fuente_origen || 'manual',
  }
}

/* ---------------- Productos ---------------- */

// Cache en memoria (30s): en serverless sobrevive entre invocaciones tibias
// y recorta lecturas de Firestore (cada listado son ~950 reads).
const _productsCache = { ts: 0, active: null, all: null }
const PRODUCTS_TTL_MS = 30 * 1000
export function clearProductsCache() { _productsCache.ts = 0; _productsCache.active = null; _productsCache.all = null }

export async function getProducts({ activeOnly = true } = {}) {
  try {
    const now = Date.now()
    const key = activeOnly ? 'active' : 'all'
    if (now - _productsCache.ts < PRODUCTS_TTL_MS && _productsCache[key]) {
      return _productsCache[key]
    }
    const db = getFirestoreDb()
    let q = db.collection(PRODUCTS)
    if (activeOnly) q = q.where('active', '==', true)
    const snap = await q.get()
    const rows = snap.docs.map(docToProduct)
    _productsCache.ts = now
    _productsCache[key] = rows
    return rows
  } catch (e) {
    if (useMock(e)) return mockStore.getProducts({ activeOnly })
    throw e
  }
}

export async function getProductById(id) {
  try {
    const db = getFirestoreDb()
    const doc = await db.collection(PRODUCTS).doc(String(id)).get()
    if (!doc.exists) return null
    return docToProduct(doc)
  } catch (e) {
    if (useMock(e)) return mockStore.getProductById(id)
    throw e
  }
}

export async function createProduct(data) {
  try {
    const db = getFirestoreDb()
    const ref = await db.collection(PRODUCTS).add({
      ...productToDoc(data),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    clearProductsCache()
    return docToProduct(await ref.get())
  } catch (e) {
    if (useMock(e)) return mockStore.createProduct(data)
    throw e
  }
}

export async function updateProduct(id, data) {
  try {
    const db = getFirestoreDb()
    const ref = db.collection(PRODUCTS).doc(String(id))
    const existing = await ref.get()
    if (!existing.exists) return null
    const merged = { ...docToProduct(existing), ...data }
    await ref.set({ ...productToDoc(merged), updatedAt: new Date().toISOString() })
    clearProductsCache()
    return docToProduct(await ref.get())
  } catch (e) {
    if (useMock(e)) return mockStore.updateProduct(id, data)
    throw e
  }
}

export async function deleteProduct(id) {
  try {
    const db = getFirestoreDb()
    const ref = db.collection(PRODUCTS).doc(String(id))
    const existing = await ref.get()
    if (!existing.exists) return false
    await ref.delete()
    clearProductsCache()
    return true
  } catch (e) {
    if (useMock(e)) return mockStore.deleteProduct(id)
    throw e
  }
}

/* ---------------- Pedidos ---------------- */

export async function createOrder({ customer, items }) {
  try {
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
        subtotal += p.price * qty
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
        payment_method: ['mercadopago', 'transferencia', 'tarjeta', 'efectivo'].includes(customer.paymentMethod)
          ? customer.paymentMethod
          : 'transferencia',
        tipo_entrega: ['envio', 'retiro'].includes(customer.tipoEntrega) ? customer.tipoEntrega : 'envio',
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
  } catch (e) {
    if (useMock(e)) return mockStore.createOrder({ customer, items })
    throw e
  }
}

export async function getOrders({ status } = {}) {
  try {
    const db = getFirestoreDb()
    let q = db.collection(ORDERS)
    if (status) q = q.where('status', '==', status)
    const snap = await q.get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    return rows
  } catch (e) {
    if (useMock(e)) return mockStore.getOrders({ status })
    throw e
  }
}

export async function getOrderById(id) {
  try {
    const db = getFirestoreDb()
    const doc = await db.collection(ORDERS).doc(String(id)).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() }
  } catch (e) {
    if (useMock(e)) return mockStore.orders.find(o=> String(o.id)===String(id)) || null
    throw e
  }
}

export async function getOrderByCode(code) {
  try {
    const db = getFirestoreDb()
    const snap = await db.collection(ORDERS).where('code', '==', code).limit(1).get()
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() }
  } catch (e) {
    if (useMock(e)) return mockStore.getOrderByCode(code)
    throw e
  }
}

export async function updateOrderStatus(id, status) {
  try {
    const db = getFirestoreDb()
    const ref = db.collection(ORDERS).doc(String(id))
    const existing = await ref.get()
    if (!existing.exists) return false
    await ref.update({ status })
    return true
  } catch (e) {
    if (useMock(e)) return mockStore.updateOrderStatus(id, status)
    throw e
  }
}

export async function updateOrderPatch(id, patch) {
  try {
    const db = getFirestoreDb()
    const ref = db.collection(ORDERS).doc(String(id))
    const existing = await ref.get()
    if (!existing.exists) return false
    await ref.update(patch)
    return true
  } catch (e) {
    if (useMock(e)) return mockStore.updateOrderPatch(id, patch)
    throw e
  }
}

export async function updateOrderStatusByCode(code, status) {
  try {
    const order = await getOrderByCode(code)
    if (!order) return false
    return updateOrderStatus(order.id, status)
  } catch (e) {
    if (useMock(e)) {
      const o = mockStore.getOrderByCode(code)
      if (!o) return false
      return mockStore.updateOrderStatus(o.id, status)
    }
    throw e
  }
}

/* ---------------- MercadoPago ---------------- */

export async function logMpPayment({ code, preferenceId, payload }) {
  try {
    const db = getFirestoreDb()
    await db.collection(MP_PAYMENTS).add({
      order_code: code,
      preference_id: preferenceId ?? null,
      payload,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    if (useMock(e)) return
    throw e
  }
}

/* ---------------- Consultas (encargo WhatsApp) ---------------- */

export async function createConsulta({ sku, nombre, marca, telefono, mensaje, origen = 'whatsapp' }) {
  try {
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
  } catch (e) {
    if (useMock(e)) return mockStore.createConsulta({ sku, nombre, marca, telefono, mensaje, origen })
    throw e
  }
}
