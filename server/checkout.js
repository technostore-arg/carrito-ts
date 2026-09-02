import { getFirestoreDb, COLLECTIONS, FREE_SHIPPING_THRESHOLD, SHIPPING_COST } from './firebase.js'
import { docToProduct } from './db.js'
import { mockStore } from './mock-store.js'
function isMock(e){ return e && String(e.message||'').includes('FIREBASE_NO_CONFIG')}

const { PRODUCTS, PENDING_CHECKOUTS } = COLLECTIONS

/**
 * Create a Mercado Pago preference for a cart.
 * Expects { customer, items } where items are { id, qty }.
 * Returns { init_point, sandbox_init_point, code }.
 */
export async function createPreference({ customer, items }) {
  // Validate
  if (!customer?.name || !customer?.email) {
    throw new Error('Faltan datos del cliente')
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('El carrito está vacío')
  }

  try {
  const db = getFirestoreDb()
  // Fetch products to verify stock and get details
  const productRefs = items.map(it => db.collection(PRODUCTS).doc(String(it.id)))
  const productSnaps = await db.getAll(...productRefs)
  const products = []
  let subtotal = 0
  for (let i = 0; i < productSnaps.length; i++) {
    const snap = productSnaps[i]
    if (!snap.exists) {
      throw new Error(`Producto ${items[i].id} no encontrado`)
    }
    const product = docToProduct(snap)
    const qty = Number(items[i].qty)
    if (qty <= 0) throw new Error(`Cantidad inválida para producto ${product.sku}`)
    if (product.stock < qty) {
      throw new Error(`Stock insuficiente de "${product.nombre}" (disponible: ${product.stock})`)
    }
    subtotal += product.precio * qty
    products.push({ product, qty })
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping

  // Generate order code
  const crypto = await import('node:crypto')
  const code = `TS-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

  // Save pending checkout (with expiration 1 hour)
  const pendingRef = db.collection(PENDING_CHECKOUTS).doc(code)
  await pendingRef.set({
    customer,
    items: items.map(it => ({ id: it.id, qty: Number(it.qty) })),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
  })

  // Build preference items for Mercado Pago
  const preferenceItems = products.map(({ product, qty }) => ({
    title: product.nombre,
    quantity: qty,
    unit_price: Number(product.precio),
    currency_id: 'ARS',
  }))

  // Base URL for back_urls (we'll try to infer from request later; for now use env or default)
  // We'll pass the base URL as argument from the caller; but we can also compute from req in handler.
  // For now, we'll leave placeholder and replace in handler.
  // We'll return the items and let the handler add back_urls.
  return {
    items: preferenceItems,
    external_reference: code,
    // back_urls will be added by the handler using the request's origin
  }
  } catch (e) { if (isMock(e)) return mockStore.createPreference({ customer, items }); throw e }
}

/**
 * Handle Mercado Pago webhook.
 * Verifies payment, creates order, decrements stock, and cleans pending checkout.
 */
export async function handleWebhook(reqBody) {
  // Extract payment ID from various possible formats
  let paymentId = null
  if (reqBody?.id) {
    paymentId = reqBody.id
  } else if (reqBody?.data?.id) {
    paymentId = reqBody.data.id
  } else if (reqBody?.body?.id) {
    paymentId = reqBody.body.id
  }
  if (!paymentId) {
    throw new Error('No se pudo obtener payment_id del webhook')
  }

  // Fetch payment from Mercado Pago
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado')
  }
  const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}?access_token=${accessToken}`)
  if (!mpResp.ok) {
    throw new Error(`Error al obtener pago ${paymentId}: ${mpResp.status}`)
  }
  const payment = await mpResp.json()

  // We only care about approved payments
  if (payment.status !== 'approved') {
    // Not an error, just not approved yet
    return { status: 'ignored', reason: `Payment status is ${payment.status}` }
  }

  const externalReference = payment.external_reference
  if (!externalReference || !externalReference.startsWith('TS-')) {
    throw new Error('external_reference no válido')
  }

  const db = getFirestoreDb()
  const pendingRef = db.collection(PENDING_CHECKOUTS).doc(externalReference)
  const pendingSnap = await pendingRef.get()
  if (!pendingSnap.exists) {
    // Maybe already processed
    return { status: 'ignored', reason: 'Pending checkout no encontrado o ya procesado' }
  }
  const pendingData = pendingSnap.data()
  // Check expiration
  const expiresAt = new Date(pendingData.expiresAt || 0)
  if (expiresAt < new Date()) {
    await pendingRef.delete()
    return { status: 'ignored', reason: 'Pending checkout expirado' }
  }

  const { customer, items } = pendingData

  // Verify stock again and compute total
  const productRefs = items.map(it => db.collection(PRODUCTS).doc(String(it.id)))
  const productSnaps = await db.getAll(...productRefs)
  let subtotal = 0
  const orderItems = []
  for (let i = 0; i < productSnaps.length; i++) {
    const snap = productSnaps[i]
    if (!snap.exists) {
      throw new Error(`Producto ${items[i].id} no encontrado al confirmar pago`)
    }
    const product = docToProduct(snap)
    const qty = items[i].qty
    if (product.stock < qty) {
      throw new Error(`Stock insuficiente de "${product.nombre}" al confirmar pago (disponible: ${product.stock})`)
    }
    subtotal += product.precio * qty
    orderItems.push({
      producto_id: snap.id,
      nombre: product.nombre,
      emoji: product.emoji ?? '📦',
      qty,
      precio_unitario: product.precio,
    })
    // We'll decrement stock in a transaction later
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping

  // Create order document and decrement stock in a transaction
  await db.runTransaction(async (tx) => {
    // First, decrement stock for each product
    for (const it of orderItems) {
      const productRef = db.collection(PRODUCTS).doc(it.producto_id)
      const productSnap = await tx.get(productRef)
      if (!productSnap.exists) throw new Error(`Producto desapareció durante la transacción`)
      const product = docToProduct(productSnap)
      const newStock = product.stock - it.qty
      tx.update(productRef, { stock: newStock })
    }
    // Create order document
    const orderDoc = {
      code: externalReference,
      customer_name: customer.name?.trim() || '',
      email: customer.email?.trim() || '',
      phone: customer.phone || '',
      city: customer.city || '',
      address: customer.address || '',
      payment_method: customer.paymentMethod || 'mercadopago',
      subtotal,
      shipping,
      total,
      status: 'pagado',
      created_at: new Date().toISOString(),
      items: orderItems,
    }
    const orderRef = db.collection(COLLECTIONS.ORDERS).doc()
    tx.set(orderRef, orderDoc)
  })

  // Delete pending checkout
  await pendingRef.delete()

  // Log to MP payments (optional)
  await db.collection(COLLECTIONS.MP_PAYMENTS).add({
    order_code: externalReference,
    payment_id: payment.id,
    status: payment.status,
    detalle: payment,
    created_at: new Date().toISOString(),
  })

  return { status: 'success', orderCode: externalReference }
}