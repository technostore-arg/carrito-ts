import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import db, { rowToProduct } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'technostore2026'
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || ''

const CATEGORIES = ['gpus', 'memorias', 'workstations', 'accesorios']

const app = express()
app.use(express.json())

const sessions = new Map()

const FREE_SHIPPING_THRESHOLD = 300000
const SHIPPING_COST = 15000

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

app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all()
  res.json(rows.map(rowToProduct))
})

app.get('/api/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' })
  res.json(rowToProduct(row))
})

function validateProduct(body) {
  const errors = []
  if (!body.name || String(body.name).trim().length < 3) errors.push('Nombre inválido')
  if (!CATEGORIES.includes(body.category)) errors.push('Categoría inválida')
  if (!(Number(body.price) > 0)) errors.push('Precio inválido')
  return errors
}

app.post('/api/products', auth, (req, res) => {
  const errors = validateProduct(req.body)
  if (errors.length) return res.status(400).json({ error: errors.join(', ') })
  const b = req.body
  const info = db.prepare(`
    INSERT INTO products (name, brand, category, price, old_price, rating, reviews, stock, badge, emoji, specs, vram, cuda, tflops, frameworks, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    b.name.trim(), b.brand?.trim() || '', b.category,
    Number(b.price), b.oldPrice ? Number(b.oldPrice) : null,
    Number(b.rating) || 4.5, Number(b.reviews) || 0,
    Number(b.stock) || 0, b.badge?.trim() || null,
    b.emoji?.trim() || '📦', JSON.stringify(Array.isArray(b.specs) ? b.specs : []),
    b.vram ?? null, b.cuda ?? null, b.tflops ?? null,
    JSON.stringify(Array.isArray(b.frameworks) ? b.frameworks : []),
    b.image?.trim() || null,
  )
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(rowToProduct(row))
})

app.put('/api/products/:id', auth, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' })
  const b = { ...rowToProduct(existing), ...req.body }
  const errors = validateProduct(b)
  if (errors.length) return res.status(400).json({ error: errors.join(', ') })
  db.prepare(`
    UPDATE products SET name=?, brand=?, category=?, price=?, old_price=?, rating=?,
      reviews=?, stock=?, badge=?, emoji=?, specs=?, active=?, vram=?, cuda=?, tflops=?, frameworks=?, image=?
    WHERE id=?
  `).run(
    b.name.trim(), b.brand?.trim() || '', b.category,
    Number(b.price), b.oldPrice ? Number(b.oldPrice) : null,
    Number(b.rating), Number(b.reviews), Number(b.stock),
    b.badge || null, b.emoji || '📦', JSON.stringify(b.specs || []),
    b.active ? 1 : 0,
    b.vram ?? null, b.cuda ?? null, b.tflops ?? null,
    JSON.stringify(Array.isArray(b.frameworks) ? b.frameworks : []),
    b.image || null,
    existing.id,
  )
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id)
  res.json(rowToProduct(row))
})

app.delete('/api/products/:id', auth, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })
  res.json({ ok: true })
})

/* ---------------- Orders ---------------- */

app.post('/api/orders', (req, res) => {
  const { customer, items } = req.body || {}
  if (!customer?.name || !customer?.email) {
    return res.status(400).json({ error: 'Faltan datos del cliente' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' })
  }

  const getStock = db.prepare('SELECT id, name, emoji, price, stock FROM products WHERE id = ?')
  let subtotal = 0
  const resolved = []

  for (const it of items) {
    const p = getStock.get(it.id)
    if (!p) return res.status(400).json({ error: `Producto ${it.id} inexistente` })
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1))
    if (qty > p.stock) {
      return res.status(400).json({ error: `Stock insuficiente de "${p.name}" (${p.stock} disponibles)` })
    }
    resolved.push({ product_id: p.id, name: p.name, emoji: p.emoji, qty, unit_price: p.price })
    subtotal += p.price * qty
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping
  const code = `TS-${randomBytes(3).toString('hex').toUpperCase()}`

  db.exec('BEGIN')
  try {
    const orderId = db.prepare(`
      INSERT INTO orders (code, customer_name, email, phone, city, address, payment_method, subtotal, shipping, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, customer.name.trim(), customer.email.trim(),
      customer.phone || '', customer.city || '', customer.address || '',
      ['mercadopago', 'transferencia', 'tarjeta'].includes(customer.paymentMethod)
        ? customer.paymentMethod
        : 'mercadopago',
      subtotal, shipping, total,
    ).lastInsertRowid

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, emoji, qty, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
    for (const r of resolved) {
      insertItem.run(orderId, r.product_id, r.name, r.emoji, r.qty, r.unit_price)
      decStock.run(r.qty, r.product_id)
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    console.error(e)
    return res.status(500).json({ error: 'Error al registrar el pedido' })
  }

  res.status(201).json({ ok: true, code, total })
})

/* ---------------- Orders ---------------- */

app.get('/api/orders', auth, (req, res) => {
  const status = req.query.status
  const rows = status
    ? db.prepare('SELECT * FROM orders ORDER BY id DESC').all().filter(o => o.status === status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC').all()
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?')
  res.json(rows.map(o => ({ ...o, items: itemsStmt.all(o.id) })))
})

app.patch('/api/orders/:id', auth, (req, res) => {
  const allowed = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado']
  if (!allowed.includes(req.body?.status)) {
    return res.status(400).json({ error: 'Estado inválido' })
  }
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, req.params.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Pedido no encontrado' })
  res.json({ ok: true })
})

/* ---------------- MercadoPago ---------------- */

app.post('/api/mp/create-preference', async (req, res) => {
  const { code } = req.body || {}
  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' })

  if (!MP_TOKEN) {
    return res.json({ mock: true, code: order.code })
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
  const base = `${req.protocol}://${req.get('host')}`
  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${MP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(i => ({
          title: i.name,
          quantity: i.qty,
          unit_price: i.unit_price,
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
    db.prepare('INSERT INTO mp_payments (order_code, preference_id, payload) VALUES (?, ?, ?)')
      .run(order.code, d.id ?? null, JSON.stringify(d))
    res.json({ init_point: d.init_point ?? d.sandbox_init_point, code: order.code })
  } catch (e) {
    console.error('[mp]', e.message)
    res.status(502).json({ error: 'No se pudo crear la preferencia de MercadoPago' })
  }
})

app.post('/api/mp/webhook', (req, res) => {
  try {
    const body = req.body || {}
    const data = body.data || {}
    const ref = data.external_reference || body.external_reference || null
    db.prepare('INSERT INTO mp_payments (order_code, preference_id, payload) VALUES (?, ?, ?)')
      .run(ref, String(data.id ?? ''), JSON.stringify(body))
    if (ref && (body.type === 'payment' || body.action?.includes('payment'))) {
      db.prepare("UPDATE orders SET status = 'pagado' WHERE code = ?").run(ref)
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
import { existsSync } from 'node:fs'

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
