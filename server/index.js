import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderPatch,
  getOrderByCode,
  logMpPayment,
  createConsulta,
} from './db.js'
import { handleNormalizeCatalogFile } from './ingesta/handler.js'
import { listBorradores, getBorrador, aplicarBorrador, descartarBorrador, createBorradorGeneric } from './ingesta/borradores.js'
import { scrapeAll as scrapeInsumosAcuario, normalizeForStore as normIA, diff as diffIA } from './ingesta/scrapers/insumosacuario.js'
import { createPreference, handleWebhook } from './checkout.js'
import { applyPricing } from './ingesta/pricing.js'
import { getFirestoreDb, COLLECTIONS } from './firebase.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'technostore2026'
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || ''

const CATEGORIES = ['celulares', 'notebooks', 'computadoras', 'gpus', 'memorias', 'accesorios', 'coolers', 'ram', 'ram-sodimm', 'ssd', 'ssd-nvme', 'ssd-sata', 'gabinetes', 'watercooling', 'procesadores']

const app = express()

/* ---------------- CORS (configurable via ALLOWED_ORIGINS env var) ---------------- */
const DEFAULT_ORIGINS = [
  'https://technostore-arg.vercel.app',
  'https://futurohard.vercel.app',
  'https://technostore-arg-futurohard.vercel.app',
]
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
const ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json({ limit: '20mb' }))

const sessions = new Map()

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  next()
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/* ---------------- Auth ---------------- */

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {}
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' })
  }
  const token = randomBytes(24).toString('hex')
  sessions.set(token, Date.now())
  res.json({ token })
})

/* ---------------- Products ---------------- */

app.get('/api/products', async (req, res) => {
  try {
    const rows = await getProducts({ activeOnly: true })
    // Cache de edge (Vercel CDN): el catálogo cambia poco y cada
    // lectura son ~950 reads de Firestore. 2 min + stale 10 min.
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    res.json(rows)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await getProductById(req.params.id)
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    res.json(row)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

function validateProduct(body) {
  const errors = []
  if (!body.name && !body.nombre) errors.push('Nombre inválido')
  const cat = body.category || body.categoria
  if (!CATEGORIES.includes(cat)) errors.push('Categoría inválida')
  if (!(Number(body.price || body.precio) > 0)) errors.push('Precio inválido')
  return errors
}

app.post('/api/products', auth, async (req, res) => {
  try {
    const errors = validateProduct(req.body)
    if (errors.length) return res.status(400).json({ error: errors.join(', ') })
    const row = await createProduct(req.body)
    res.status(201).json(row)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.put('/api/products/:id', auth, async (req, res) => {
  try {
    const existing = await getProductById(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' })
    const merged = { ...existing, ...req.body }
    const errors = validateProduct(merged)
    if (errors.length) return res.status(400).json({ error: errors.join(', ') })
    const row = await updateProduct(req.params.id, req.body)
    res.json(row)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.delete('/api/products/:id', auth, async (req, res) => {
  try {
    const ok = await deleteProduct(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

/* ---------------- Upload: imágenes de producto a Firebase Storage ---------------- */

const IMG_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const IMG_ALLOWED_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const IMG_MAX_BYTES = 5 * 1024 * 1024 // 5 MB per image after resize

app.post('/api/upload/product-image', auth, async (req, res) => {
  try {
    const { imageBase64, sku, index } = req.body || {}
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 requerido' })
    }
    if (!sku || typeof sku !== 'string') {
      return res.status(400).json({ error: 'sku requerido' })
    }

    const buffer = Buffer.from(imageBase64, 'base64')
    if (buffer.length > IMG_MAX_BYTES) {
      return res.status(413).json({ error: 'Imagen supera 5 MB (intenta reducir calidad o tamaño antes de subir)' })
    }

    // Detect MIME from magic bytes
    let mime = 'application/octet-stream'
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) mime = 'image/jpeg'
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) mime = 'image/png'
    else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) mime = 'image/webp'

    if (!IMG_ALLOWED_MIME.includes(mime)) {
      return res.status(400).json({ error: 'Tipo no permitido. Solo JPG, PNG o WebP.' })
    }

    const ext = IMG_ALLOWED_EXT[mime]
    const ts = Date.now()
    const idx = typeof index === 'number' ? index : 0
    const storagePath = `productos/${sku.trim().toUpperCase()}/${ts}-${idx}.${ext}`

    console.log(`[upload] Imagen producto ${sku} → ${storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`)

    let url = null
    try {
      const { getStorage } = await import('firebase-admin/storage')
      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)
      await file.save(buffer, {
        contentType: mime,
        metadata: { metadata: { sku: sku.trim().toUpperCase(), index: String(idx) } },
      })
      await file.makePublic()
      url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
    } catch (storageErr) {
      console.error('[upload] Firebase Storage error:', storageErr.message)
      return res.status(500).json({ error: 'Error al subir imagen a Storage' })
    }

    res.json({ ok: true, url, storagePath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ---------------- Ingesta — borradores_catalogo ---------------- */

app.post('/api/ingesta/upload', auth, async (req, res) => {
  try {
    const { fileBase64, fileName, mimeType, contentBase64, pricing } = req.body || {}
    const b64 = fileBase64 || contentBase64
    if (!b64 || !fileName) return res.status(400).json({ error: 'Falta fileBase64 y fileName' })
    const buffer = Buffer.from(b64, 'base64')
    if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Archivo muy grande (max 12MB)' })
    const ext = fileName.toLowerCase().split('.').pop()
    if (!['xlsx', 'xls', 'csv', 'pdf', 'txt'].includes(ext)) return res.status(400).json({ error: 'Formato no soportado: usa xlsx, csv, pdf o txt' })
    // pricing opcional: { esCosto:boolean, usdRate, mpFeePercent, fixedUsd, margenExtraPercent, margenPorCategoria }
    let pricingCfg = null
    if (pricing && pricing.esCosto) {
      pricingCfg = {
        esCosto: true,
        usdRate: Number(pricing.usdRate) || Number(process.env.USD_ARS_RATE) || 1550,
        mpFeePercent: pricing.mpFeePercent != null ? Number(pricing.mpFeePercent) : (Number(process.env.MP_FEE_PERCENT) || 6.5),
        fixedUsd: pricing.fixedUsd != null && pricing.fixedUsd !== '' ? Number(pricing.fixedUsd) : null,
        margenExtraPercent: pricing.margenExtraPercent != null ? Number(pricing.margenExtraPercent) : 0,
        margenPorCategoria: pricing.margenPorCategoria || null,
      }
    }
    const marcaForzada = req.body?.marca && ['technostore','futurohard'].includes(String(req.body.marca).toLowerCase()) ? String(req.body.marca).toLowerCase() : null
    const { borrador, errores, pricingDetalle } = await handleNormalizeCatalogFile({ buffer, fileName, mime: mimeType || '', origen: 'archivo', pricing: pricingCfg, marca: marcaForzada })
    res.status(201).json({ ok: true, borradorId: borrador.id, resumen: borrador.resumen, errores: errores.slice(0, 8), pricingDetalle: pricingDetalle || null, pricing: pricingCfg })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/borradores', auth, async (req, res) => {
  try { res.json(await listBorradores({ estado: req.query.estado })) } catch (e) { res.status(503).json({ error: e.message }) }
})
app.get('/api/borradores/:id', auth, async (req, res) => {
  try {
    const b = await getBorrador(req.params.id)
    if (!b) return res.status(404).json({ error: 'Borrador no encontrado' })
    res.json(b)
  } catch (e) { res.status(503).json({ error: e.message }) }
})
app.post('/api/borradores', auth, async (req, res) => {
  try {
    const { origen = 'scraping', archivoNombre = null, fuenteId = null, propuestas } = req.body || {}
    if (!Array.isArray(propuestas) || !propuestas.length) return res.status(400).json({ error: 'propuestas debe ser array no vacío' })
    if (!['archivo', 'scraping'].includes(origen)) return res.status(400).json({ error: 'origen debe ser archivo | scraping' })
    const b = await createBorradorGeneric({ origen, archivoNombre, fuenteId, propuestas })
    res.status(201).json({ ok: true, borradorId: b.id, resumen: b.resumen })
  } catch (e) { res.status(500).json({ error: e.message }) }
})
app.post('/api/borradores/:id/aplicar', auth, async (req, res) => {
  try {
    const skus = Array.isArray(req.body?.skus) ? req.body.skus : null
    const b = await aplicarBorrador({ id: req.params.id, skusAprobados: skus, aprobadoPor: req.headers['x-admin-user'] || 'admin' })
    res.json({ ok: true, borrador: b })
  } catch (e) { res.status(400).json({ error: e.message }) }
})
app.post('/api/borradores/:id/descartar', auth, async (req, res) => {
  try {
    const b = await descartarBorrador({ id: req.params.id, por: req.headers['x-admin-user'] || 'admin' })
    res.json({ ok: true, borrador: b })
  } catch (e) { res.status(400).json({ error: e.message }) }
})
// Recalcular precios de un borrador pendiente si el archivo era de costo y querés ajustar margen
app.post('/api/borradores/:id/recalcular', auth, async (req, res) => {
  try {
    const { pricing } = req.body || {}
    if (!pricing || !pricing.esCosto) return res.status(400).json({ error: 'Falta pricing.esCosto' })
    const b = await getBorrador(req.params.id)
    if (!b) return res.status(404).json({ error: 'Borrador no encontrado' })
    if (b.estado !== 'pendiente') return res.status(400).json({ error: 'Solo borradores pendientes se pueden recalcular' })
    // Revertir a costo si existe _costo_original, si no asumir precio actual como costo
    const propuestasCosto = b.propuestas.map(p => {
      const costo = p.especificaciones?._costo_original ?? p.costo_original ?? p.precio
      return { ...p, precio: costo, costo_original: costo }
    })
    const pricingCfg = {
      esCosto: true,
      usdRate: Number(pricing.usdRate) || Number(process.env.USD_ARS_RATE) || 1550,
      mpFeePercent: pricing.mpFeePercent != null ? Number(pricing.mpFeePercent) : 6.5,
      fixedUsd: pricing.fixedUsd != null && pricing.fixedUsd !== '' ? Number(pricing.fixedUsd) : null,
      margenExtraPercent: pricing.margenExtraPercent != null ? Number(pricing.margenExtraPercent) : 0,
      margenPorCategoria: pricing.margenPorCategoria || null,
    }
    const { productos, detalle } = applyPricing(propuestasCosto, pricingCfg)
    // Actualizar borrador en Firestore/mock: re-crear diff
    const { computeDiff } = await import('./ingesta/borradores.js')
    const { mockStore } = await import('./mock-store.js')
    // Intentar Firestore, fallback mock
    let updated
    try {
      const db = getFirestoreDb()
      const ref = db.collection('borradores_catalogo').doc(String(req.params.id))
      const { resumirIngesta } = await import('../packages/catalog-schema/index.js')
      const existentes = [] // para recalcular resumen basta con propuestas
      // usar computeDiff con lista vacía no sirve, usamos resumir
      // recalculamos resumen simple
      const diff = computeDiff({ existentes: [], normalizados: productos })
      await ref.update({
        propuestas: productos,
        resumen: diff.resumen,
        altas: diff.altas,
        bajas: diff.bajas,
        modificaciones: diff.modificaciones,
        llmMeta: { ...(b.llmMeta || {}), pricing: { ...pricingCfg, detalle } },
        'log': [...(b.log || []), { accion: 'recalculo_precio', en: new Date().toISOString(), pricing: pricingCfg }],
      })
      const snap = await ref.get()
      updated = { id: snap.id, ...snap.data() }
    } catch (e) {
      if (String(e.message||'').includes('FIREBASE_NO_CONFIG')) {
        const bb = mockStore.getBorrador(req.params.id)
        const { resumirIngesta } = await import('../packages/catalog-schema/index.js')
        // recalcular diff mock simple
        const diff = { resumen: { altas: productos.length, bajas: 0, cambiosPrecio: 0, sinCambios: 0 }, altas: productos, bajas: [], modificaciones: [] }
        bb.propuestas = productos
        bb.resumen = diff.resumen
        bb.altas = diff.altas
        bb.llmMeta = { ...(bb.llmMeta||{}), pricing: { ...pricingCfg, detalle } }
        bb.log.push({ accion: 'recalculo_precio', en: new Date().toISOString(), pricing: pricingCfg })
        updated = bb
      } else throw e
    }
    res.json({ ok: true, borrador: updated, detalle })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

/* ---------------- Consultas (encargo WhatsApp) ---------------- */

app.post('/api/consultas', async (req, res) => {
  try {
    const { sku, nombre, marca, telefono, mensaje } = req.body || {}
    const id = await createConsulta({ sku, nombre, marca, telefono, mensaje, origen: 'whatsapp' })
    res.status(201).json({ ok: true, id })
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

/* ---------------- Orders ---------------- */

app.post('/api/orders', async (req, res) => {
  try {
    const { customer, items } = req.body || {}
    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ error: 'Faltan datos del cliente' })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' })
    }
    const result = await createOrder({ customer, items })
    
    // Send WhatsApp notification to admin
    try {
      const WhatsAppNumber = '5491127650658'
      const itemsList = items.map(i => `• ${i.nombre || i.id} x${i.qty}`).join('%0A')
      const adminMsg = `🛒 *NUEVO PEDIDO*%0A%0ACódigo: *${result.code}*%0ACliente: ${customer.name}%0ATel: ${customer.phone || 'N/A'}%0A%0AItems:%0A${itemsList}%0A%0AMétodo: ${customer.paymentMethod || 'No especificado'}`
      const adminUrl = `https://wa.me/${WhatsAppNumber}?text=${adminMsg}`
      // Fire-and-forget notification log
      fetch(adminUrl).catch(() => {})
    } catch {}
    
    res.status(201).json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/orders', auth, async (req, res) => {
  try {
    const rows = await getOrders({ status: req.query.status })
    res.json(rows)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.patch('/api/orders/:id', auth, async (req, res) => {
  try {
    const validStatuses = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado', 'pendiente_verificacion', 'listo_para_retirar', 'retirado']
    const patch = {}
    if (req.body.status) {
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: 'Estado inválido' })
      }
      patch.status = req.body.status
    }
    if (req.body.notes !== undefined) patch.notes = req.body.notes
    if (req.body.tracking !== undefined) patch.tracking = req.body.tracking
    if (req.body.estadoPago !== undefined) patch.estadoPago = req.body.estadoPago
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' })
    }
    const ok = await updateOrderPatch(req.params.id, patch)
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

/* ---------------- MercadoPago (legacy, kept for reference) ---------------- */
/* The following endpoints are kept but not used in the new flow.
   They remain for possible future use or backward compatibility. */
app.post('/api/mp/create-preference', async (req, res) => {
  try {
    const { code } = req.body || {}
    const order = await getOrderByCode(code)
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' })

    if (!MP_TOKEN) {
      return res.json({ mock: true, code: order.code })
    }

    const base = `${req.protocol}://${req.get('host')}`
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: (order.items || []).map((i) => ({
          title: i.nombre,
          quantity: i.qty,
          unit_price: i.precio_unitario,
          currency_id: 'ARS',
        })),
        external_reference: order.code,
        statement_descriptor: 'TECHNOSTORE',
        back_urls: {
          success: `${base}/gracias?pedido=${order.code}`,
          pending: `${base}/gracias?pedido=${order.code}&estado=pendiente`,
          failure: `${base}/gracias?pedido=${order.code}&estado=fallo`,
        },
        auto_return: 'approved',
      }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.message || 'Error de MercadoPago')
    await logMpPayment({ code: order.code, preferenceId: d.id ?? null, payload: d })
    res.json({ init_point: d.init_point ?? d.sandbox_init_point, code: order.code })
  } catch (e) {
    console.error('[mp]', e.message)
    res.status(502).json({ error: 'No se pudo crear la preferencia de MercadoPago' })
  }
})

app.post('/api/mp/webhook', async (req, res) => {
  try {
    const body = req.body || {}
    const data = body.data || {}
    const ref = data.external_reference || body.external_reference || null
    await logMpPayment({ code: ref, preferenceId: String(data.id ?? ''), payload: body })
    if (ref && (body.type === 'payment' || body.action?.includes('payment'))) {
      await updateOrderStatusByCode(ref, 'pagado')
    }
  } catch (e) {
    console.error('[mp webhook]', e.message)
  }
  res.sendStatus(200)
})

/* ---------------- Checkout (Mercado Pago) ---------------- */

app.post('/api/checkout/crear-preferencia', async (req, res) => {
  try {
    const { customer, items } = req.body || {}
    const { items: prefItems, external_reference: code } = await createPreference({ customer, items })
    const base = `${req.protocol}://${req.get('host')}`
    const preferenceData = {
      items: prefItems,
      external_reference: code,
      back_urls: {
        success: `${base}/gracias?pedido=${code}&estado=success`,
        pending: `${base}/gracias?pedido=${code}&estado=pending`,
        failure: `${base}/gracias?pedido=${code}&estado=failure`,
      },
      auto_return: 'approved',
    }
    // Mock mode: sin token MP devuelve init_point local para probar flujo sin MercadoPago
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.json({
        init_point: `${base}/gracias?pedido=${code}&estado=success&mock=1`,
        sandbox_init_point: `${base}/gracias?pedido=${code}&estado=success&mock=1`,
        id: `mock-${code}`,
        code,
        mock: true,
      })
    }
    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preferenceData),
    })
    const prefResult = await mpResp.json()
    if (!mpResp.ok) {
      throw new Error(prefResult.message || 'Error al crear preferencia de MercadoPago')
    }
    res.json({
      init_point: prefResult.init_point,
      sandbox_init_point: prefResult.sandbox_init_point,
      id: prefResult.id,
      code,
    })
  } catch (e) {
    console.error('[checkout/create-preference]', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/checkout/webhook', async (req, res) => {
  try {
    const result = await handleWebhook(req.body)
    // Always respond 200 to Mercado Pago to avoid retries
    res.json({ ok: true, ...result })
  } catch (e) {
    console.error('[checkout/webhook]', e.message)
    // Still respond 200 to avoid retries, but include error in body for debugging
    res.status(200).json({ ok: false, error: e.message })
  }
})

/* ---------------- Comprobantes de transferencia ---------------- */

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ALLOWED_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

app.post('/api/comprobantes', async (req, res) => {
  try {
    const { orderCode, customerName, comprobanteData } = req.body || {}

    if (!orderCode || typeof orderCode !== 'string') {
      return res.status(400).json({ error: 'orderCode requerido' })
    }
    if (!comprobanteData || typeof comprobanteData !== 'string') {
      return res.status(400).json({ error: 'comprobanteData requerido (base64)' })
    }

    // Decode base64
    const buffer = Buffer.from(comprobanteData, 'base64')
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: 'El comprobante supera el tamaño máximo de 8 MB' })
    }

    // Detect MIME from magic bytes
    let mime = 'application/octet-stream'
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) mime = 'image/jpeg'
    else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) mime = 'image/png'
    else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) mime = 'image/webp'
    else if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) mime = 'application/pdf'

    if (!ALLOWED_MIME.includes(mime)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG, WebP o PDF.' })
    }

    const ext = ALLOWED_EXT[mime]
    const timestamp = Date.now()
    const storagePath = `comprobantes/${orderCode}/${timestamp}.${ext}`

    console.log(`[comprobante] Recibido para pedido ${orderCode} de ${customerName || 'unknown'} (${(buffer.length / 1024).toFixed(0)} KB, ${mime})`)

    // Upload to Firebase Storage
    let comprobanteUrl = null
    try {
      const { getStorage } = await import('firebase-admin/storage')
      const bucket = getStorage().bucket()
      const file = bucket.file(storagePath)
      await file.save(buffer, {
        contentType: mime,
        metadata: { metadata: { orderCode, customerName: customerName || '' } },
      })
      // Make publicly readable (or use a signed URL if you prefer private)
      await file.makePublic()
      comprobanteUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`
    } catch (storageErr) {
      console.error('[comprobante] Firebase Storage error:', storageErr.message)
      return res.status(500).json({ error: 'Error al subir comprobante a Storage' })
    }

    // Create/update Firestore document in "pedidos" collection
    try {
      const db = getFirestoreDb()
      const pedidosRef = db.collection(COLLECTIONS.ORDERS)
      const q = await pedidosRef.where('code', '==', orderCode).limit(1).get()

      if (!q.empty) {
        const docRef = q.docs[0].ref
        await docRef.update({
          comprobanteUrl,
          comprobanteStoragePath: storagePath,
          metodoPago: 'transferencia',
          estadoPago: 'pendiente_verificacion',
          comprobanteUploadedAt: new Date().toISOString(),
        })
      } else {
        // Order doesn't exist yet (race condition) — create a pending record
        await pedidosRef.add({
          code: orderCode,
          customerName: customerName || 'unknown',
          metodoPago: 'transferencia',
          estadoPago: 'pendiente_verificacion',
          comprobanteUrl,
          comprobanteStoragePath: storagePath,
          comprobanteUploadedAt: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
      }
    } catch (fsErr) {
      console.error('[comprobante] Firestore error:', fsErr.message)
      // Storage already succeeded — still return ok to frontend
    }

    res.json({ ok: true, comprobante: { orderCode, customerName, comprobanteUrl, timestamp: new Date().toISOString() } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* ---------------- Static: admin + build de producción ---------------- */

const ADMIN_LEGACY_DIR = path.join(__dirname, 'public')
const TS_DIST = path.join(__dirname, '..', 'apps', 'technostore', 'dist')
const FH_DIST = path.join(__dirname, '..', 'apps', 'futurohard', 'dist')
const ADMIN_DIST = path.join(__dirname, '..', 'apps', 'admin', 'dist')
const FALLBACK_DIST = path.join(__dirname, '..', 'dist')

const noCacheHtml = (res, filePath) => {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
}
for (const [prefix, dir] of [
  ['/futurohard', FH_DIST],
  ['/admin', ADMIN_DIST],
]) {
  app.use(prefix, express.static(dir, { setHeaders: noCacheHtml }))
  app.get(new RegExp(`^${prefix}(\/.*)?$`), (req, res) => {
    const legacy = path.join(ADMIN_LEGACY_DIR, 'admin.html')
    const candidates = [path.join(dir, 'index.html'), legacy, path.join(FALLBACK_DIST, 'index.html')]
    for (const c of candidates) if (existsSync(c)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return res.sendFile(c)
    }
    res.status(404).send('Build no encontrado — ejecutá npm run build')
  })
}

app.get(/^\/admin(\/.*)?$/, (req, res) => {
  const legacy = path.join(ADMIN_LEGACY_DIR, 'admin.html')
  const candidates = [path.join(ADMIN_DIST, 'index.html'), legacy]
  for (const c of candidates) if (existsSync(c)) return res.sendFile(c)
  res.status(404).send('Admin no encontrado')
})
app.use('/admin', express.static(ADMIN_DIST))
app.use('/admin', express.static(ADMIN_LEGACY_DIR))

/* ---------------- Scraping: Insumos Acuario ---------------- */
const SCRAPE_INTERVAL_MS = 6 * 60 * 60 * 1000
let lastScrapeResult = null

async function runScrapeInsumosAcuario() {
  console.log('[scrape] Starting Insumos Acuario scrape...')
  try {
    const scraped = await scrapeInsumosAcuario()
    const normalized = normIA(scraped)
    const allProducts = await getProducts()
    const existing = allProducts.filter(p => p.fuente_origen === 'scraping_insumosacuario' || p.marca === 'insumosacuario')
    const changes = diffIA(existing, normalized)
    let created = 0, updated = 0
    for (const p of changes.news) {
      createProduct({ sku: p.sku, nombre: p.nombre, precio: p.precio, marca: p.marca && p.marca !== 'insumosacuario' ? p.marca : 'Genérica', categoria: p.categoria, stock: p.stock, tipo_venta: 'directa', descripcion: p.descripcion, imagenes: p.imagenes, fuente_origen: 'scraping_insumosacuario' })
      created++
    }
    for (const c of changes.priceChanges) { const p = existing.find(x => x.sku === c.sku); if (p) { updateProduct(p.id, { precio: c.new }); updated++ } }
    for (const c of changes.stockChanges) { const p = existing.find(x => x.sku === c.sku); if (p) { updateProduct(p.id, { stock: c.newStock }); updated++ } }
    lastScrapeResult = { ts: new Date().toISOString(), scraped: scraped.length, created, updated, priceChanges: changes.priceChanges.length, stockChanges: changes.stockChanges.length, removed: changes.removed.length }
    console.log(`[scrape] Done: ${created} new, ${updated} updated, ${changes.priceChanges.length} price, ${changes.stockChanges.length} stock`)
    return lastScrapeResult
  } catch (e) {
    console.error('[scrape] Error:', e.message)
    lastScrapeResult = { ts: new Date().toISOString(), error: e.message }
    return lastScrapeResult
  }
}
setInterval(() => { runScrapeInsumosAcuario().catch(() => {}) }, SCRAPE_INTERVAL_MS)

app.get('/api/scrape/insumosacuario', auth, async (req, res) => {
  try { const r = await runScrapeInsumosAcuario(); res.json({ ok: true, ...r }) } catch (e) { res.status(500).json({ error: e.message }) }
})
app.get('/api/scrape/status', auth, (req, res) => {
  res.json({ lastResult: lastScrapeResult, intervalHours: SCRAPE_INTERVAL_MS / 3600000 })
})

const MAIN_DIST = existsSync(TS_DIST) ? TS_DIST : FALLBACK_DIST
app.use(express.static(MAIN_DIST, { setHeaders: noCacheHtml }))
app.get(/^\/(?!api|futurohard|admin).*/, (req, res) => {
  const cand = path.join(MAIN_DIST, 'index.html')
  if (existsSync(cand)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res.sendFile(cand)
  }
  res.status(404).send('Frontend no encontrado')
})

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`[server] API + admin en http://localhost:${PORT}`)
    console.log(`[server] Admin password: ${ADMIN_PASSWORD}`)
  })
}

export default app
