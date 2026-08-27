import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderStatusByCode,
  getOrderByCode,
  logMpPayment,
  createConsulta,
} from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'technostore2026'
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || ''

const CATEGORIES = ['gpus', 'memorias', 'workstations', 'accesorios']

const app = express()
app.use(express.json())

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
    res.json(rows)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await getProductById(req.params.id)
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(row)
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

function validateProduct(body) {
  const errors = []
  if (!body.name || String(body.name).trim().length < 3) errors.push('Nombre inválido')
  if (!CATEGORIES.includes(body.category)) errors.push('Categoría inválida')
  if (!(Number(body.price) > 0)) errors.push('Precio inválido')
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
    const allowed = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado']
    if (!allowed.includes(req.body?.status)) {
      return res.status(400).json({ error: 'Estado inválido' })
    }
    const ok = await updateOrderStatus(req.params.id, req.body.status)
    if (!ok) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json({ ok: true })
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

/* ---------------- MercadoPago ---------------- */

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

app.listen(PORT, () => {
  console.log(`[server] API + admin en http://localhost:${PORT}`)
  console.log(`[server] Admin password: ${ADMIN_PASSWORD}`)
})
