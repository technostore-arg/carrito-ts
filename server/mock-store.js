/**
 * server/mock-store.js — Fallback in-memory para dev sin Firestore
 * Se activa cuando getFirestoreDb() throw FIREBASE_NO_CONFIG
 * Replica la misma forma API que Firestore pero en memoria.
 */
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Seed vacío — solo productos subidos por el usuario vía ingesta
let seed = []

const PERSIST_FILE = path.join(__dirname, '.mock-data.json')

function loadPersisted() {
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8'))
      return raw
    }
  } catch {}
  return null
}
function persist() {
  try {
    fs.writeFileSync(PERSIST_FILE, JSON.stringify({ products, orders, consultas, borradores }, null, 2))
  } catch {}
}
const saved = loadPersisted()
let products = saved?.products ?? [...seed]
let orders = saved?.orders ?? []
let consultas = saved?.consultas ?? []
let borradores = saved?.borradores ?? []
let pending = new Map()
let mpPay = []

function genId() { return randomBytes(6).toString('hex') }

// Imágenes locales por modelo — descargadas en public/images/celulares/
const IMAGE_BY_MODEL = [
  { test: /POCO F7 ULTRA/i, url: '/images/celulares/xiaomi-poco-f7-ultra.jpg' },
  { test: /POCO F8 ULTRA/i, url: '/images/celulares/xiaomi-poco-f8-ultra.jpg' },
  { test: /POCO F8 PRO/i, url: '/images/celulares/xiaomi-poco-f8-pro.jpg' },
  { test: /POCO F5 PRO/i, url: '/images/celulares/xiaomi-poco-f5-pro-2.jpg' },
  { test: /POCO F7 PRO/i, url: '/images/celulares/xiaomi-poco-f7-pro.jpg' },
  { test: /POCO F7\b/i, url: '/images/celulares/xiaomi-poco-f7.jpg' },
  { test: /POCO F5\b/i, url: '/images/celulares/xiaomi-poco-f5-2.jpg' },
  { test: /POCO F1/i, url: '/images/celulares/xiaomi-pocophone-f1-.jpg' },
  { test: /POCO X8 PRO MAX/i, url: '/images/celulares/xiaomi-poco-x8-pro.jpg' },
  { test: /POCO X8 PRO/i, url: '/images/celulares/xiaomi-poco-x8-pro.jpg' },
  { test: /POCO X7 PRO/i, url: '/images/celulares/xiaomi-poco-x7-pro.jpg' },
  { test: /POCO X7\b/i, url: '/images/celulares/xiaomi-poco-x7.jpg' },
  { test: /POCO X6 PRO/i, url: '/images/celulares/xiaomi-poco-x6-pro.jpg' },
  { test: /POCO X4 PRO/i, url: '/images/celulares/xiaomi-poco-x4-pro.jpg' },
  { test: /POCO X3 GT/i, url: '/images/celulares/xiaomi-poco-x3.jpg' },
  { test: /POCO M8 PRO/i, url: '/images/celulares/xiaomi-poco-m8-pro.jpg' },
  { test: /POCO M8\b/i, url: '/images/celulares/xiaomi-poco-m8.jpg' },
  { test: /POCO M7 PRO/i, url: '/images/celulares/xiaomi-poco-m7-pro-5g.jpg' },
  { test: /POCO M7\b/i, url: '/images/celulares/xiaomi-poco-m7-5g.jpg' },
  { test: /POCO M6\b/i, url: '/images/celulares/xiaomi-poco-m6-pro-5g.jpg' },
  { test: /POCO M3/i, url: '/images/celulares/xiaomi-poco-m3.jpg' },
  { test: /POCO C85/i, url: '/images/celulares/xiaomi-poco-c85.jpg' },
  { test: /POCO C71/i, url: '/images/celulares/xiaomi-poco-c71.jpg' },
  { test: /POCO C65/i, url: '/images/celulares/xiaomi-poco-c65.jpg' },
  { test: /MI 17 ULTRA/i, url: '/images/celulares/xiaomi-17-ultra.jpg' },
  { test: /MI 17T PRO/i, url: '/images/celulares/xiaomi-17t-pro.jpg' },
  { test: /MI 17T\b/i, url: '/images/celulares/xiaomi-17t.jpg' },
  { test: /MI 17\b/i, url: '/images/celulares/xiaomi-17.jpg' },
  { test: /MI 15T PRO/i, url: '/images/celulares/xiaomi-15t-pro.jpg' },
  { test: /MI 15T\b/i, url: '/images/celulares/xiaomi-15t.jpg' },
  { test: /MI 13T PRO/i, url: '/images/celulares/xiaomi-13t-pro.jpg' },
  { test: /MI 13 LITE/i, url: '/images/celulares/xiaomi-13-lite.jpg' },
  { test: /MI 12 LITE/i, url: '/images/celulares/xiaomi-12-lite-5g.jpg' },
  { test: /MIX FLIP/i, url: '/images/celulares/xiaomi-mix-flip.jpg' },
  { test: /NOTE 15 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-15-pro-plus-5g.jpg' },
  { test: /NOTE 15 PRO/i, url: '/images/celulares/xiaomi-redmi-note-15-pro-5g.jpg' },
  { test: /XIAOMI NOTE 15 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-15-pro-plus-5g.jpg' },
  { test: /NOTE 14 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-14-pro-plus-5g.jpg' },
  { test: /NOTE 14 PRO/i, url: '/images/celulares/xiaomi-redmi-note-14-pro-5g.jpg' },
  { test: /NOTE 14S/i, url: '/images/celulares/xiaomi-redmi-note-14-5g.jpg' },
  { test: /NOTE 14\b/i, url: '/images/celulares/xiaomi-redmi-note-14-5g.jpg' },
  { test: /NOTE 13 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-13-pro-plus.jpg' },
  { test: /NOTE 13 PRO/i, url: '/images/celulares/xiaomi-redmi-note-13-pro.jpg' },
  { test: /NOTE 12 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-12-pro-plus.jpg' },
  { test: /NOTE 12 PRO/i, url: '/images/celulares/xiaomi-redmi-note-12-pro.jpg' },
  { test: /NOTE 12\b/i, url: '/images/celulares/xiaomi-redmi-note-12-5g.jpg' },
  { test: /NOTE 11S 5G/i, url: '/images/celulares/xiaomi-redmi-note-11s-5g.jpg' },
  { test: /NOTE 11\b/i, url: '/images/celulares/xiaomi-redmi-note-11-4g.jpg' },
  { test: /NOTE 9S/i, url: '/images/celulares/xiaomi-redmi-note-9-pro.jpg' },
  { test: /REDMI A5/i, url: '/images/celulares/xiaomi-redmi-a5-4g.jpg' },
  { test: /REDMI 1[45]C/i, url: '/images/celulares/xiaomi-redmi-14c.jpg' },
  { test: /REDMI 13\b/i, url: '/images/celulares/xiaomi-redmi-13.jpg' },
  { test: /XIAOMI A7 PRO/i, url: '/images/celulares/xiaomi-redmi-a3.jpg' },
  { test: /REDMI/i, url: '/images/celulares/xiaomi-redmi-14c.jpg' },
  { test: /S26 ULTRA/i, url: '/images/celulares/samsung-galaxy-s26-ultra.jpg' },
  { test: /S26 PLUS/i, url: '/images/celulares/samsung-galaxy-s26-plus.jpg' },
  { test: /S26\b/i, url: '/images/celulares/samsung-galaxy-s26.jpg' },
  { test: /S25 ULTRA/i, url: '/images/celulares/samsung-galaxy-s25-ultra-sm-s938.jpg' },
  { test: /S25 FE/i, url: '/images/celulares/samsung-galaxy-s25-fe.jpg' },
  { test: /S24 FE/i, url: '/images/celulares/samsung-galaxy-s24-fe-5g.jpg' },
  { test: /Z FOLD 8 ULTRA/i, url: '/images/celulares/samsung-galaxy-z-fold7.jpg' },
  { test: /Z FOLD 8\b/i, url: '/images/celulares/samsung-galaxy-z-fold6.jpg' },
  { test: /SAMSUNG A07/i, url: '/images/celulares/samsung-galaxy-a07.jpg' },
  { test: /SAMSUNG A06/i, url: '/images/celulares/samsung-galaxy-a06-5g.jpg' },
  { test: /SAMSUNG A05S/i, url: '/images/celulares/samsung-galaxy-a05s.jpg' },
  { test: /SAMSUNG A04S/i, url: '/images/celulares/samsung-galaxy-a04s.jpg' },
  { test: /SAMSUNG A04E/i, url: '/images/celulares/samsung-galaxy-a04e.jpg' },
  { test: /SAMSUNG A04\b/i, url: '/images/celulares/samsung-galaxy-a04.jpg' },
  { test: /SAMSUNG A03 CORE/i, url: '/images/celulares/samsung-galaxy-a03-core.jpg' },
  { test: /SAMSUNG A03/i, url: '/images/celulares/samsung-galaxy-a03.jpg' },
  { test: /SAMSUNG A14/i, url: '/images/celulares/samsung-galaxy-a14-5g.jpg' },
  { test: /SAMSUNG A12/i, url: '/images/celulares/samsung-galaxy-a12-nacho.jpg' },
  { test: /SAMSUNG/i, url: '/images/celulares/samsung-galaxy-a14-5g.jpg' },
]

const DEFAULT_PHONE_IMG = '/images/celulares/xiaomi-redmi-note-13-pro.jpg'

function fixImage(sku, imagenes, nombre = '') {
  const hasValid = Array.isArray(imagenes) && imagenes.length && imagenes[0] && String(imagenes[0]).length > 10
  if (hasValid) return imagenes
  // Buscar por nombre del producto
  const n = String(nombre || sku || '')
  for (const { test, url } of IMAGE_BY_MODEL) {
    if (test.test(n)) return [url]
  }
  // Fallback para celulares sin match específico
  if (/celulares/i.test(n) || /REDMI|POCO|MI |XIAOMI|SAMSUNG/i.test(n)) return [DEFAULT_PHONE_IMG]
  return Array.isArray(imagenes) && imagenes.length ? imagenes : [DEFAULT_PHONE_IMG]
}

// Generador de descripciones reales basado en el nombre del producto
function genDescripcion(nombre, categoria, specs) {
  const n = nombre.toUpperCase()
  const s = specs || {}

  // Helper: extract storage/RAM from name
  const storageMatch = n.match(/(\d+)\s*(GB|TB)/i)
  const storage = storageMatch ? storageMatch[0] : ''
  const ramMatch = n.match(/(\d+)\s*GB\s*RAM/i)
  const ram = ramMatch ? ramMatch[0] : ''

  if (categoria === 'celulares') {
    const brand = n.includes('SAMSUNG') ? 'Samsung' : n.includes('POCO') ? 'POCO' : n.includes('MI ') || n.includes('XIAOMI') ? 'Xiaomi' : n.includes('IPHONE') ? 'Apple' : n.includes('PIXEL') ? 'Google' : n.includes('MOTO') ? 'Motorola' : ''
    const model = n.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    if (n.includes('PIXEL')) return `${brand} ${model}. Android puro con Tensor G3, cámara computacional líder en la industria y 7 años de actualizaciones. Experiencia Google pura.`
    if (n.includes('ULTRA')) return `${brand} ${model}. Cámara premium con zoom óptico, pantalla AMOLED de alto rendimiento y batería de larga duración. Rendimiento tope de gama.`
    if (n.includes('PRO')) return `${brand} ${model}. Procesador de alta gama, cámara mejorada con IA y diseño premium. Potencia y estilo en un solo dispositivo.`
    if (n.includes('FOLD') || n.includes('FLIP')) return `${brand} ${model}. Diseño plegable innovador, pantalla flexible y rendimiento premium. La convergencia entre teléfono y tablet.`
    if (n.includes('A14') || n.includes('A15') || n.includes('A16') || n.includes('A25') || n.includes('A35') || n.includes('A55')) return `${brand} ${model}. Excelente relación precio-calidad, pantalla grande, batería de larga duración y cámara confiable para el día a día.`
    if (n.includes('POCO F')) return `${brand} ${model}. Flagship killer: procesador potente, pantalla AMOLED 120Hz, carga rápida y cámara triple. Rendimiento de gama alta a precio competitivo.`
    if (n.includes('MI 1') || n.includes('MI 2')) return `${brand} ${model}. Cámara Leica, pantalla AMOLED LTPO, carga ultrarrápida y diseño elegante. Tecnología puntera con sellos de calidad.`
    if (n.includes('REDMI NOTE')) return `${brand} ${model}. Pantalla grande, batería 5000mAh+, cámara de alta resolución y rendimiento fluido. Ideal para uso intensivo.`
    if (n.includes('REDMI')) return `${brand} ${model}. Batería de larga duración, pantalla amplia y rendimiento confiable. Calidad Xiaomi a precio accesible.`
    if (n.includes('MOTO G')) return `${brand} ${model}. Pantalla AMOLED, batería de larga duración, cámara con IA y experiencia Android pura. Diseño elegante y rendimiento fluido.`
    if (n.includes('MOTO E')) return `${brand} ${model}. Batería extra-large, pantalla grande y rendimiento básico confiable. Ideal como segundo celular o para uso esencial.`
    return `${brand} ${model}. Dispositivo con especificaciones destacadas, pantalla de alta calidad y rendimiento confiable.`
  }

  if (categoria === 'notebooks') {
    const brand = n.includes('MACBOOK') ? 'Apple' : n.includes('DELL') ? 'Dell' : n.includes('LENOVO') ? 'Lenovo' : n.includes('ASUS') ? 'ASUS' : n.includes('HP') ? 'HP' : ''
    if (n.includes('MACBOOK')) return `${brand} ${storage}. Chip ${n.includes('M3') ? 'M3' : n.includes('M2') ? 'M2' : 'M1'} de última generación, pantalla Liquid Retina, hasta 18h de batería y diseño ultraliviano. Rendimiento excepcional para trabajo y creatividad.`
    if (n.includes('THINKPAD')) return `${brand} ${storage}. Estación de trabajo empresarial con teclado legendario, seguridad integrada y rendimiento robusto para profesionales.`
    if (n.includes('YOGA') || n.includes('FLEX')) return `${brand} ${storage}. Conversible 360° con pantalla táctil, lápiz compatible y rendimiento versatile para creativos y profesionales.`
    if (n.includes('ZENBOOK')) return `${brand} ${storage}. Ultraligera con pantalla OLED, diseño premium y autonomía extendida. Potencia y portabilidad en equilibrio perfecto.`
    if (n.includes('XPS')) return `${brand} ${storage}. Diseño compacto premium, pantalla InfinityEdge OLED y rendimiento sólido. La referencia en ultrabooks.`
    if (n.includes('GAMER') || n.includes('GAMING')) return `${brand} ${storage}. Potencia bruta para gaming: GPU dedicada, pantalla de alta tasa de refresco y sistema de refrigeración avanzado.`
    return `${brand} ${storage}. Notebook con rendimiento confiable, pantalla de calidad y diseño pensado para productividad.`
  }

  if (categoria === 'computadoras') {
    if (n.includes('PC GAMER') || n.includes('GAMING')) return `Computadora armada para gaming de alto rendimiento. GPU dedicada, procesador potente y refrigeración optimizada para sesiones largas.`
    if (n.includes('MINI PC')) return `Mini PC compacta y silenciosa. Ideal como media center, servidor doméstico o estación de trabajo ligera. Bajo consumo de energía.`
    if (n.includes('WORKSTATION')) return `Estación de trabajo profesional para modelado 3D, edición de video y renderizado. ECC RAM y certificación ISV.`
    return `Computadora de escritorio con componentes seleccionados para rendimiento y confiabilidad.`
  }

  if (categoria === 'gpus') {
    if (n.includes('4090')) return `GPU NVIDIA flagship con 24GB GDDR6X. Rendimiento extremo para IA, renderizado 4K y gaming ultra. La más potente del mercado.`
    if (n.includes('4080')) return `GPU de alto rendimiento con 16GB GDDR6X. Perfecta para gaming 4K, IA y creación de contenido profesional.`
    if (n.includes('4070')) return `GPU con excelente relación rendimiento/precio. 12GB GDDR6X, ideal para gaming 1440p y workloads de IA.`
    if (n.includes('4060')) return `GPU eficiente con 8GB GDDR6. Rendimiento sólido para gaming 1080p/1440p y entradas al mundo de la IA.`
    if (n.includes('3090')) return `GPU anterior generación con 24GB VRAM. Aún excelente para entrenamiento de modelos y gaming de alta resolución.`
    if (n.includes('A100') || n.includes('H100')) return `GPU datacenter para entrenamiento de modelos a escala. Tensor Cores de nueva generación y alta memoria HBM2e.`
    if (n.includes('MI100') || n.includes('MI300')) return `GPU AMD para IA y HPC. Arquitectura CDNA con alta capacidad de cómputo paralelo.`
    return `GPU de alto rendimiento para gaming, IA y creación de contenido.`
  }

  if (categoria === 'memorias') {
    if (n.includes('DDR5')) return `Memoria RAM DDR5 de última generación. Mayor ancho de banda y eficiencia energética. Ideal para sistemas actuales y next-gen.`
    if (n.includes('DDR4')) return `Memoria RAM DDR4 confiable. Compatible con la mayoría de sistemas actuales. Excelente relación precio-rendimiento.`
    if (n.includes('ECC')) return `Memoria ECC con corrección de errores. Diseñada para servidores y estaciones de trabajo where la integridad de datos es crítica.`
    return `Memoria de alta velocidad para mejorar el rendimiento de tu sistema.`
  }

  if (categoria === 'accesorios') {
    if (n.includes('SSD') || n.includes('NVME')) return `Disco SSD NVMe de alta velocidad. Lecturas de hasta 7000MB/s. Ideal para ampliar almacenamiento y acelerar el sistema.`
    if (n.includes('AIRPODS')) return `Auriculares inalámbricos con cancelación activa de ruido, audio espacial y estuche de carga MagSafe. Calidad Apple.`
    if (n.includes('TECLADO') || n.includes('KEYBOARD')) return `Teclado mecánico de perfil bajo. Switches táctiles, retroiluminación RGB y conectividad dual.`
    if (n.includes('MOUSE')) return `Mouse ergonómico con sensor de alta precisión. Ideal para oficina o gaming según el modelo.`
    if (n.includes('MONITOR') || n.includes('PANTALLA')) return `Monitor de alta resolución con paneles IPS/OLED. Colores precisos y tiempos de respuesta rápidos.`
    if (n.includes('CARGADOR') || n.includes('CHARGER')) return `Cargador rápido universal. Compatibilidad con múltiples dispositivos y protección contra sobrecarga.`
    if (n.includes('FUND') || n.includes('CASE') || n.includes('COVER')) return `Funda protectora con acabados premium. Protección completa sin sacrificar diseño.`
    return `Accesorio de calidad para complementar tu equipo.`
  }

  return `Producto de calidad con las mejores especificaciones para tu necesidad.`
}

export const mockStore = {
  products,
  orders,
  consultas,
  borradores,

  getProducts({ activeOnly } = {}) {
    let list = activeOnly ? products.filter(p => p.active !== false) : [...products]
    // Ensure every product has both Spanish and English field names
    return list.map(p => {
      const nombre = p.nombre || p.name || ''
      const precio = Number(p.precio ?? p.price ?? 0)
      const marca = p.marca || p.brand || 'technostore'
      const categoria = (p.categoria || p.category || 'accesorios').toLowerCase()
      const imagenes = fixImage(p.sku, Array.isArray(p.imagenes) ? p.imagenes : p.image ? [p.image] : [], nombre)
      const especificaciones = p.especificaciones || (Array.isArray(p.specs) ? Object.fromEntries(p.specs.map(s => [s, s])) : {})
      const cleanSpecs = Object.fromEntries(Object.entries(especificaciones).filter(([k]) => !k.startsWith('_')))
      const descripcion = (p.descripcion && p.descripcion.length > 20 && !p.descripcion.toUpperCase().includes(nombre.toUpperCase().substring(0, 10))) ? p.descripcion : genDescripcion(nombre, categoria, cleanSpecs)
      return { ...p, nombre, name: nombre, precio, price: precio, marca, brand: marca, categoria, category: categoria, imagenes, image: imagenes[0] || null, especificaciones: cleanSpecs, specs: Object.values(cleanSpecs), tipo_venta: p.tipo_venta || 'directa', stock: p.tipo_venta === 'encargo' ? null : Number(p.stock ?? 0), descripcion, estado: p.estado || 'activo', moneda: p.moneda || 'ARS', fuente_origen: p.fuente_origen || 'manual' }
    })
  },
  getProductById(id) {
    return products.find(p => String(p.id) === String(id)) || null
  },
  createProduct(data) {
    const id = genId()
    const nombre = data.nombre || data.name || 'Sin nombre'
    const precio = Number(data.precio ?? data.price) || 0
    const marca = data.marca || data.brand || 'technostore'
    const categoria = (data.categoria || data.category || 'accesorios').toLowerCase()
    const imagenes = Array.isArray(data.imagenes) ? data.imagenes : data.image ? [data.image] : []
    const especificaciones = data.especificaciones || (Array.isArray(data.specs) ? Object.fromEntries(data.specs.map(s => [s, s])) : {})
    const p = {
      id,
      sku: data.sku ? String(data.sku).toUpperCase() : `TS-${genId().slice(0,6).toUpperCase()}`,
      nombre, name: nombre,
      precio, price: precio,
      marca, brand: marca,
      categoria, category: categoria,
      tipo_venta: data.tipo_venta || 'directa',
      stock: data.tipo_venta === 'encargo' ? null : Number(data.stock ?? 0),
      descripcion: data.descripcion || data.description || '',
      imagenes, image: imagenes[0] || null,
      especificaciones, specs: Object.values(especificaciones),
      emoji: data.emoji || '📦',
      active: data.active !== undefined ? !!data.active : true,
      vram: data.vram ?? null,
      cuda: data.cuda ?? null,
      tflops: data.tflops ?? null,
      frameworks: Array.isArray(data.frameworks) ? data.frameworks : [],
      estado: data.estado || 'activo',
      moneda: data.moneda || 'ARS',
      fuente_origen: data.fuente_origen || 'manual',
      rating: Number(data.rating) || 4.5,
      reviews: Number(data.reviews) || 0,
    }
    products.push(p)
    persist()
    return p
  },
  updateProduct(id, data) {
    const idx = products.findIndex(p => String(p.id) === String(id))
    if (idx === -1) return null
    const prev = products[idx]
    const nombre = data.nombre || data.name || prev.nombre
    const precio = data.precio !== undefined ? Number(data.precio) : data.price !== undefined ? Number(data.price) : prev.precio
    const marca = data.marca || data.brand || prev.marca
    const categoria = (data.categoria || data.category || prev.categoria || 'accesorios').toLowerCase()
    const imagenes = Array.isArray(data.imagenes) ? data.imagenes : data.image !== undefined ? [data.image] : prev.imagenes
    const especificaciones = data.especificaciones || prev.especificaciones
    products[idx] = { ...prev, ...data, id: String(id), nombre, name: nombre, precio, price: precio, marca, brand: marca, categoria, category: categoria, imagenes, image: imagenes?.[0] || null, especificaciones, specs: Object.values(especificaciones || {}) }
    persist()
    return products[idx]
  },
  deleteProduct(id) {
    const idx = products.findIndex(p => String(p.id) === String(id))
    if (idx === -1) return false
    products.splice(idx, 1)
    persist()
    return true
  },
  createOrder({ customer, items }) {
    const code = `TS-${randomBytes(3).toString('hex').toUpperCase()}`
    let subtotal = 0
    const resolved = []
    for (const it of items) {
      const p = products.find(x => String(x.id) === String(it.id))
      if (!p) throw new Error(`Producto ${it.id} inexistente`)
      const qty = Math.max(1, Math.floor(Number(it.qty) || 1))
      if (qty > (p.stock || 0)) throw new Error(`Stock insuficiente de "${p.name}" (${p.stock} disponibles)`)
      p.stock -= qty
      subtotal += p.price * qty
      resolved.push({ producto_id: p.id, nombre: p.name, emoji: p.emoji, qty, precio_unitario: p.price })
    }
    const SHIP_THR = 300000, SHIP_COST = 15000
    const shipping = subtotal >= SHIP_THR ? 0 : SHIP_COST
    const total = subtotal + shipping
    const order = { id: genId(), code, customer_name: customer.name?.trim(), email: customer.email?.trim(), phone: customer.phone || '', city: customer.city || '', address: customer.address || '', payment_method: customer.paymentMethod || 'mercadopago', subtotal, shipping, total, status: 'pendiente', created_at: new Date().toISOString(), items: resolved }
    orders.push(order)
    persist()
    return { code, total }
  },
  getOrders({ status } = {}) {
    let rows = [...orders]
    if (status) rows = rows.filter(r => r.status === status)
    rows.sort((a,b)=> String(b.created_at).localeCompare(String(a.created_at)))
    return rows
  },
  getOrderByCode(code) { return orders.find(o=>o.code===code) || null },
  updateOrderStatus(id, status) {
    const o = orders.find(x=> String(x.id)===String(id))
    if (!o) return false
    o.status = status
    return true
  },
  createConsulta(data) {
    const id = genId()
    consultas.push({ id, ...data, createdAt: new Date().toISOString() })
    persist()
    return id
  },

  // Borradores
  listBorradores({ estado } = {}) {
    let rows = [...borradores]
    if (estado) rows = rows.filter(b=> b.estado===estado)
    rows.sort((a,b)=> String(b.creadoEn).localeCompare(String(a.creadoEn)))
    return rows
  },
  getBorrador(id) { return borradores.find(b=> String(b.id)===String(id)) || null },
  createBorrador({ origen, archivoNombre, archivoHash, propuestas, diff, llmMeta, fuenteId }) {
    const id = genId()
    const doc = { id, creadoEn: new Date().toISOString(), origen, archivoNombre, archivoHash, fuenteId, estado: 'pendiente', propuestas, resumen: diff?.resumen || { altas: propuestas.length, bajas:0, cambiosPrecio:0, sinCambios:0 }, altas: diff?.altas || [], bajas: diff?.bajas || [], modificaciones: diff?.modificaciones || [], llmMeta, log: [{ accion: 'creado', en: new Date().toISOString(), origen }] }
    borradores.push(doc)
    persist()
    return doc
  },
  createBorradorGeneric({ origen, archivoNombre, fuenteId, propuestas }) {
    // diff simple
    const porSku = new Map(products.map(p=>[String(p.sku).toUpperCase(), p]))
    const altas = propuestas.filter(p=> !porSku.has(String(p.sku).toUpperCase()))
    const modificaciones = []
    for (const p of propuestas) {
      const ex = porSku.get(String(p.sku).toUpperCase())
      if (ex && Number(ex.price) !== Number(p.precio || p.price)) modificaciones.push({ sku: p.sku, antes: ex, despues: p, cambios:[{campo:'precio', antes: ex.price, despues: p.precio || p.price}] })
    }
    const diff = { resumen: { altas: altas.length, bajas:0, cambiosPrecio: modificaciones.length, sinCambios: propuestas.length - altas.length - modificaciones.length }, altas, bajas: [], modificaciones }
    return this.createBorrador({ origen, archivoNombre, propuestas, diff, llmMeta: { provider: 'mock' }, fuenteId })
  },
  aplicarBorrador({ id, skusAprobados, aprobadoPor }) {
    const b = this.getBorrador(id)
    if (!b) throw new Error('Borrador no encontrado')
    if (b.estado === 'aplicado') throw new Error('Borrador ya aplicado')
    const filtradas = skusAprobados?.length ? b.propuestas.filter(p=> skusAprobados.includes(p.sku)) : b.propuestas
    if (!filtradas.length) throw new Error('Nada para aplicar')
    for (const p of filtradas) {
      const sku = String(p.sku).toUpperCase()
      const nombre = p.nombre || p.name || sku
      const precio = Number(p.precio ?? p.price ?? 0)
      const marca = p.marca || p.brand || 'technostore'
      const categoria = (p.categoria || p.category || 'accesorios').toLowerCase()
      const tipo_venta = p.tipo_venta || 'directa'
      const stock = tipo_venta === 'encargo' ? null : Number(p.stock ?? 0)
      const descripcion = p.descripcion || p.description || ''
      const imagenes = Array.isArray(p.imagenes) ? p.imagenes : p.image ? [p.image] : []
      const especificaciones = p.especificaciones || (Array.isArray(p.specs) ? Object.fromEntries(p.specs.map(s => [s, s])) : {})
      let ex = products.find(x=> String(x.sku).toUpperCase()===sku)
      if (ex) Object.assign(ex, { nombre, precio, marca, categoria, tipo_venta, stock, descripcion, imagenes, especificaciones, name: nombre, price: precio, brand: marca, category: categoria, image: imagenes[0] || null, specs: Object.values(especificaciones), active: tipo_venta === 'directa' ? stock > 0 : true, updatedAt: new Date().toISOString() })
      else products.push({ id: genId(), sku, nombre, precio, marca, categoria, tipo_venta, stock, descripcion, imagenes, especificaciones, name: nombre, price: precio, brand: marca, category: categoria, image: imagenes[0] || null, specs: Object.values(especificaciones), emoji: '📦', active: tipo_venta === 'directa' ? stock > 0 : true, vram: p.vram ?? null, cuda: p.cuda ?? null, tflops: p.tflops ?? null, frameworks: Array.isArray(p.frameworks) ? p.frameworks : [], estado: 'activo', moneda: 'ARS', fuente_origen: 'archivo_normalizado' })
    }
    b.estado = 'aplicado'
    b.aplicadoEn = new Date().toISOString()
    b.aplicadoPor = aprobadoPor
    b.skusAprobados = filtradas.map(p=>p.sku)
    b.log.push({ accion: 'aplicado', en: b.aplicadoEn, por: aprobadoPor, skus: b.skusAprobados })
    persist()
    return b
  },
  descartarBorrador({ id, por }) {
    const b = this.getBorrador(id)
    if (!b) throw new Error('Borrador no encontrado')
    if (b.estado === 'aplicado') throw new Error('No se puede descartar un borrador ya aplicado')
    b.estado = 'descartado'
    b.descartadoEn = new Date().toISOString()
    b.descartadoPor = por
    b.log.push({ accion: 'descartado', en: b.descartadoEn, por })
    persist()
    return b
  },

  // Checkout mock
  pending,
  createPreference({ customer, items }) {
    const code = `TS-${randomBytes(3).toString('hex').toUpperCase()}`
    this.pending.set(code, { customer, items, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+3600000).toISOString() })
    // build items for MP mock
    const prefItems = items.map(it=>{
      const p = products.find(x=> String(x.id)===String(it.id))
      if (!p) throw new Error(`Producto ${it.id} no encontrado`)
      if (p.stock < it.qty) throw new Error(`Stock insuficiente de "${p.name}"`)
      return { title: p.name, quantity: it.qty, unit_price: p.price, currency_id: 'ARS' }
    })
    return { items: prefItems, external_reference: code }
  },

  // Debug
  _reset() { products = [...seed]; orders=[]; consultas=[]; borradores=[]; pending.clear(); persist() }
}
