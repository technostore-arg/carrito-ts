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

// Recalculate dual pricing for all products on startup
const SCRAPE_SOURCES = new Set(['scraping_insumosacuario'])
const FIXED_CATEGORIES = new Set(['celulares', 'computadoras', 'notebooks'])
const USD_RATE = Number(process.env.USD_ARS_RATE) || 1550, MP_MARKUP = 0.16

// Fijo USD por tramo de costo en USD: <250 → 50 | 250–400 → 80 | >400 → 100
function fixedUsdFor(usdCost) {
  const u = Number(usdCost) || 0
  if (u < 250) return 50
  if (u <= 400) return 80
  return 100
}

function recalcDualPricing() {
  // Check if pricing already applied (skip if all products have both fields)
  const allHavePricing = products.length > 0 && products.every(p => p.precio_transferencia != null && p.precio_mercadopago != null)
  if (allHavePricing) return

  for (const p of products) {
    if (p.tipo_venta === 'encargo' || Number(p.precio) <= 0) {
      p.precio_transferencia = p.precio || 0
      p.precio_mercadopago = p.precio || 0
      continue
    }
    // Use the raw precio as the base cost (before any markup)
    const costo = Number(p.precio) || 0
    const fuente = String(p.fuente_origen || '').toLowerCase()
    const cat = String(p.categoria || '').toLowerCase()
    let transferencia = 0
    if (SCRAPE_SOURCES.has(fuente)) {
      // InsumosAcuario: +20% over scraped price
      transferencia = Math.round(costo * 1.20)
    } else if (FIXED_CATEGORIES.has(cat)) {
      // Celulares/Notebooks/Computadoras: +fijo USD por tramo de costo
      transferencia = Math.round(costo + fixedUsdFor(costo / USD_RATE) * USD_RATE)
    } else {
      // GPU, RAM, SSD, etc: cost = transferencia
      transferencia = Math.round(costo)
    }
    p.precio_transferencia = transferencia
    p.precio_mercadopago = Math.round(transferencia * (1 + MP_MARKUP))
  }
  persist()
}
recalcDualPricing()
let pending = new Map()
let mpPay = []

function genId() { return randomBytes(6).toString('hex') }

// Imágenes locales por modelo — descargadas en public/images/celulares/
const IMAGE_BY_MODEL = [
  // POCO F series
  { test: /POCO F7 ULTRA/i, url: '/images/celulares/xiaomi-poco-f7-ultra.jpg' },
  { test: /POCO F8 ULTRA/i, url: '/images/celulares/xiaomi-poco-f8-ultra.jpg' },
  { test: /POCO F8 PRO/i, url: '/images/celulares/xiaomi-poco-f8-pro.jpg' },
  { test: /POCO F5 PRO/i, url: '/images/celulares/xiaomi-poco-f5-pro-2.jpg' },
  { test: /POCO F7 PRO/i, url: '/images/celulares/xiaomi-poco-f7.jpg' },
  { test: /POCO F7\b/i, url: '/images/celulares/xiaomi-poco-f7.jpg' },
  { test: /POCO F5\b/i, url: '/images/celulares/xiaomi-poco-f5-2.jpg' },
  { test: /POCO F1/i, url: '/images/celulares/xiaomi-pocophone-f1-.jpg' },
  // POCO X series
  { test: /POCO X8 PRO MAX/i, url: '/images/celulares/xiaomi-poco-x8-pro.jpg' },
  { test: /POCO X8 PRO/i, url: '/images/celulares/xiaomi-poco-x8-pro.jpg' },
  { test: /POCO X7 PRO/i, url: '/images/celulares/xiaomi-poco-x7-pro.jpg' },
  { test: /POCO X7\b/i, url: '/images/celulares/xiaomi-poco-x7.jpg' },
  { test: /POCO X6 PRO/i, url: '/images/celulares/xiaomi-poco-x6-pro.jpg' },
  { test: /POCO X4 PRO/i, url: '/images/celulares/xiaomi-poco-x4-pro.jpg' },
  { test: /POCO X3/i, url: '/images/celulares/xiaomi-poco-x3.jpg' },
  // POCO M series
  { test: /POCO M8 PRO/i, url: '/images/celulares/xiaomi-poco-m8-pro.jpg' },
  { test: /POCO M8\b/i, url: '/images/celulares/xiaomi-poco-m8.jpg' },
  { test: /POCO M7 PRO/i, url: '/images/celulares/xiaomi-poco-m7-pro-5g.jpg' },
  { test: /POCO M7\b/i, url: '/images/celulares/xiaomi-poco-m7-5g.jpg' },
  { test: /POCO M6\b/i, url: '/images/celulares/xiaomi-poco-m6-pro-5g.jpg' },
  { test: /POCO M3/i, url: '/images/celulares/xiaomi-poco-m3.jpg' },
  // POCO C series
  { test: /POCO C85/i, url: '/images/celulares/xiaomi-poco-c85.jpg' },
  { test: /POCO C71/i, url: '/images/celulares/xiaomi-poco-c71.jpg' },
  { test: /POCO C65/i, url: '/images/celulares/xiaomi-poco-c65.jpg' },
  // Xiaomi Mi numbered (flagship)
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
  // Xiaomi Redmi Note series
  { test: /NOTE 15 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-15-pro-plus-5g.jpg' },
  { test: /NOTE 15 PRO/i, url: '/images/celulares/xiaomi-redmi-note-15-pro-5g.jpg' },
  { test: /NOTE 14 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-14-pro-plus-5g.jpg' },
  { test: /NOTE 14 PRO/i, url: '/images/celulares/xiaomi-redmi-note-14-pro-5g.jpg' },
  { test: /NOTE 14S/i, url: '/images/celulares/xiaomi-redmi-note-14-5g.jpg' },
  { test: /NOTE 14\b/i, url: '/images/celulares/xiaomi-redmi-note-14-5g.jpg' },
  { test: /NOTE 13 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-13-pro-plus.jpg' },
  { test: /NOTE 13 PRO/i, url: '/images/celulares/xiaomi-redmi-note-13-pro.jpg' },
  { test: /NOTE 12 PRO PLUS/i, url: '/images/celulares/xiaomi-redmi-note-12-pro-plus.jpg' },
  { test: /NOTE 12 PRO/i, url: '/images/celulares/xiaomi-redmi-note-12-pro-plus.jpg' },
  { test: /NOTE 12\b/i, url: '/images/celulares/xiaomi-redmi-note-12-5g.jpg' },
  { test: /NOTE 11S/i, url: '/images/celulares/xiaomi-redmi-note-11s-5g.jpg' },
  { test: /NOTE 11\b/i, url: '/images/celulares/xiaomi-redmi-note-11-4g.jpg' },
  { test: /NOTE 9S/i, url: '/images/celulares/xiaomi-redmi-note-9-pro.jpg' },
  // Xiaomi Redmi numbered series
  { test: /REDMI A5/i, url: '/images/celulares/xiaomi-redmi-a5-4g.jpg' },
  { test: /REDMI A3/i, url: '/images/celulares/xiaomi-redmi-a3.jpg' },
  { test: /REDMI A7/i, url: '/images/celulares/xiaomi-redmi-a3.jpg' },
  { test: /REDMI 17\b/i, url: '/images/celulares/xiaomi-redmi-13.jpg' },
  { test: /REDMI 15C/i, url: '/images/celulares/xiaomi-poco-c85.jpg' },
  { test: /REDMI 15\b/i, url: '/images/celulares/xiaomi-redmi-13.jpg' },
  { test: /REDMI 14C/i, url: '/images/celulares/xiaomi-redmi-14c.jpg' },
  { test: /REDMI 13\b/i, url: '/images/celulares/xiaomi-redmi-13.jpg' },
  { test: /REDMI/i, url: '/images/celulares/xiaomi-redmi-14c.jpg' },
  // Samsung Galaxy Z foldables
  { test: /Z FOLD 8 ULTRA/i, url: '/images/celulares/samsung-galaxy-z-fold7.jpg' },
  { test: /Z FOLD 8\b/i, url: '/images/celulares/samsung-galaxy-z-fold6.jpg' },
  { test: /Z FOLD/i, url: '/images/celulares/samsung-galaxy-z-fold6.jpg' },
  // Samsung Galaxy S series
  { test: /S26 ULTRA/i, url: '/images/celulares/samsung-galaxy-s26-ultra.jpg' },
  { test: /S26 PLUS/i, url: '/images/celulares/samsung-galaxy-s26-plus.jpg' },
  { test: /S26\b/i, url: '/images/celulares/samsung-galaxy-s26.jpg' },
  { test: /S25 ULTRA/i, url: '/images/celulares/samsung-galaxy-s25-ultra-sm-s938.jpg' },
  { test: /S25 FE/i, url: '/images/celulares/samsung-galaxy-s25-fe.jpg' },
  { test: /S25\b/i, url: '/images/celulares/samsung-galaxy-s25-fe.jpg' },
  { test: /S24 FE/i, url: '/images/celulares/samsung-galaxy-s24-fe-5g.jpg' },
  // Samsung Galaxy A series
  { test: /SAMSUNG\s+A07/i, url: '/images/celulares/samsung-galaxy-a07.jpg' },
  { test: /SAMSUNG\s+A06/i, url: '/images/celulares/samsung-galaxy-a06-5g.jpg' },
  { test: /SAMSUNG\s+A05S/i, url: '/images/celulares/samsung-galaxy-a05s.jpg' },
  { test: /SAMSUNG\s+A04S/i, url: '/images/celulares/samsung-galaxy-a04s.jpg' },
  { test: /SAMSUNG\s+A04E/i, url: '/images/celulares/samsung-galaxy-a04e.jpg' },
  { test: /SAMSUNG\s+A04\b/i, url: '/images/celulares/samsung-galaxy-a04.jpg' },
  { test: /SAMSUNG\s+A03\s+CORE/i, url: '/images/celulares/samsung-galaxy-a03-core.jpg' },
  { test: /SAMSUNG\s+A03/i, url: '/images/celulares/samsung-galaxy-a03.jpg' },
  { test: /SAMSUNG\s+A14/i, url: '/images/celulares/samsung-galaxy-a14-5g.jpg' },
  { test: /SAMSUNG\s+A12/i, url: '/images/celulares/samsung-galaxy-a12-nacho.jpg' },
  { test: /SAMSUNG\s+A\d+/i, url: '/images/celulares/samsung-galaxy-a14-5g.jpg' },
]

const DEFAULT_PHONE_IMG = '/images/celulares/xiaomi-redmi-note-13-pro.jpg'

function fixImage(sku, imagenes, nombre = '', categoria = '') {
  const n = String(nombre || sku || '')
  const cat = String(categoria || '').toLowerCase()

  // Una imagen remota explícita (genérica provisoria o subida desde admin)
  // siempre gana: no la reemplazamos por la foto heurística del modelo.
  const first = Array.isArray(imagenes) && imagenes[0] ? String(imagenes[0]) : ''
  if (/^https?:\/\//i.test(first)) return imagenes

  // Only apply phone image rules to phone-related categories
  const isPhone = cat === 'celulares' || cat === 'phones' || /celular|phone|xiaomi|samsung|poco|redmi|iphone|motorola|nothing/i.test(n)
  if (isPhone) {
    for (const { test, url } of IMAGE_BY_MODEL) {
      if (test.test(n)) return [url]
    }
  }

  // If no name match, keep existing valid images
  const hasValid = Array.isArray(imagenes) && imagenes.length && imagenes[0] && String(imagenes[0]).length > 10
  if (hasValid) return imagenes
  // Fallback for phones without specific match
  if (/celulares/i.test(n) || /REDMI|POCO|MI |XIAOMI|SAMSUNG/i.test(n)) return [DEFAULT_PHONE_IMG]
  return Array.isArray(imagenes) && imagenes.length ? imagenes : [DEFAULT_PHONE_IMG]
}

// Generador de descripciones reales basado en el nombre del producto
function genDescripcion(nombre, categoria, specs) {
  const n = nombre.toUpperCase()
  const s = specs || {}

  const storageMatch = n.match(/(\d+)\s*(GB|TB)/i)
  const storage = storageMatch ? storageMatch[0] : ''
  const ramMatch = n.match(/(\d+)\s*GB\s*RAM/i)
  const ram = ramMatch ? ramMatch[0] : ''

  if (categoria === 'celulares') {
    const model = n.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()

    // Samsung Galaxy Z foldables
    if (n.includes('Z FOLD') && n.includes('ULTRA')) return `Samsung ${model}. Plegable premium con S Pen integrado, pantalla Dynamic AMOLED 2X expandible y rendimiento tope de gama. La productividad sin compromisos.`
    if (n.includes('Z FOLD')) return `Samsung ${model}. Plegable premium con pantalla Dynamic AMOLED 2X expandible, multitarea avanzada y rendimiento insuperable.`
    if (n.includes('Z FLIP')) return `Samsung ${model}. Plegable compacto con pantalla externa interactiva, diseño premium y cámaras de alta calidad. Estilo y funcionalidad.`
    // Samsung Galaxy S Ultra
    if (n.includes('SAMSUNG') && n.includes('ULTRA')) return `Samsung ${model}. Cámara principal de 200MP con zoom óptico 5x, pantalla Dynamic AMOLED 2X de 6.8", S Pen integrado y batería de larga duración. El flagship definitivo.`
    // Samsung Galaxy S+
    if (n.includes('SAMSUNG') && (n.includes('S26 PLUS') || n.includes('S25 PLUS') || n.includes('S24 PLUS'))) return `Samsung ${model}. Pantalla Dynamic AMOLED 2X de 6.7", cámara triple con IA, rendimiento flagship y batería de mayor capacidad que el modelo base.`
    // Samsung Galaxy S base
    if (n.includes('SAMSUNG') && (n.includes('S26') || n.includes('S25 5G') || n.includes('S24 5G'))) return `Samsung ${model}. Pantalla Dynamic AMOLED 2X, procesador Snapdragon de última generación, cámara con IA y diseño premium.`
    // Samsung Galaxy FE
    if (n.includes('SAMSUNG') && n.includes(' FE')) return `Samsung ${model}. Experiencia flagship a precio accesible: pantalla AMOLED, cámara principal de alta resolución, rendimiento potente y actualizaciones garantizadas.`
    // Samsung Galaxy A series
    if (n.includes('SAMSUNG') && n.includes('A0')) return `Samsung ${model}. Smartphone entry-level con pantalla grande, batería de larga duración y rendimiento confiable para el día a día.`
    if (n.includes('SAMSUNG') && n.includes('A1')) return `Samsung ${model}. Excelente relación precio-calidad con pantalla grande, batería de larga duración y cámara confiable.`
    if (n.includes('SAMSUNG') && (n.includes('A2') || n.includes('A3') || n.includes('A5'))) return `Samsung ${model}. Gama media con pantalla AMOLED, cámara múltiple y rendimiento fluido para uso intensivo.`

    // Xiaomi Mi numbered series (flagships with Leica)
    if (n.includes('MI 17 ULTRA')) return `Xiaomi ${model}. Flagship Absoluto: cámara Leica cuádriple con sensor 1", pantalla LTPO AMOLED 2K, Snapdragon 8 Elite, carga de 90W y diseño premium.`
    if (n.includes('MI 17T PRO')) return `Xiaomi ${model}. Flagship camera-phone con Leica, sensor principal de 50MP con estabilización OIS, pantalla AMOLED LTPO 120Hz y carga ultrarrápida.`
    if (n.includes('MI 17T')) return `Xiaomi ${model}. Cámara Leica con sensor de alta resolución, pantalla AMOLED LTPO 120Hz, rendimiento flagship y diseño elegante.`
    if (n.includes('MI 17')) return `Xiaomi ${model}. Procesador Snapdragon de última generación, cámara Leica, pantalla AMOLED LTPO y carga ultrarrápida.`
    if (n.includes('MI 15T PRO')) return `Xiaomi ${model}. Cámara Leica con óptica premium, pantalla AMOLED LTPO, carga de 90W y diseño sofisticado.`
    if (n.includes('MI 15T')) return `Xiaomi ${model}. Cámara Leica, pantalla AMOLED LTPO 120Hz, batería de alta capacidad y rendimiento fluido.`
    if (n.includes('MI 13T PRO')) return `Xiaomi ${model}. Cámara Leica con sensor Sony IMX906, pantalla AMOLED 144Hz, carga de 120W y procesador Dimensity 9200+.`
    if (n.includes('MI 12 LITE') || n.includes('MI 13 LITE')) return `Xiaomi ${model}. Diseño delgado y liviano, pantalla AMOLED 120Hz, cámara de alta resolución y carga rápida. Estilo accesible.`

    // Xiaomi Mix Flip
    if (n.includes('MIX FLIP')) return `Xiaomi ${model}. Plegable tipo clamshell con pantalla externa grande, cámara Leica y rendimiento flagship en formato compacto.`

    // Poco F series (flagship killers)
    if (n.includes('POCO F8 ULTRA')) return `POCO ${model}. El flagship killer definitivo: Snapdragon 8 Elite, pantalla AMOLED 2K 120Hz, cámara Sony de 50MP con OIS, carga de 120W y acabados premium.`
    if (n.includes('POCO F8 PRO')) return `POCO ${model}. Procesador Dimensity 9400, pantalla AMOLED 120Hz, cámara principal de 50MP y carga ultrarrápida de 90W.`
    if (n.includes('POCO F7 ULTRA')) return `POCO ${model}. Snapdragon 8 Elite, pantalla AMOLED 2K, cámara triple con OIS, carga de 120W y diseño renovado.`
    if (n.includes('POCO F7')) return `POCO ${model}. Procesador Dimensity 8400, pantalla AMOLED 120Hz, cámara de 50MP y batería de 6000mAh con carga rápida.`
    if (n.includes('POCO F5 PRO')) return `POCO ${model}. Snapdragon 8+ Gen 1, pantalla AMOLED 120Hz, cámara de 64MP con OIS y carga de 67W. Rendimiento de gama alta.`
    if (n.includes('POCO F5')) return `POCO ${model}. Snapdragon 7+ Gen 2, pantalla AMOLED 120Hz, cámara de 64MP y batería de 5000mAh. Potencia sin precio premium.`
    if (n.includes('POCO F1')) return `POCO ${model}. El original flagship killer: Snapdragon 845, pantalla IPS 6.18", cámara dual y rendimiento que desafió a los premiums.`

    // Poco X series (upper mid-range)
    if (n.includes('POCO X8 PRO')) return `POCO ${model}. Pantalla AMOLED 120Hz, procesador Dimensity, cámara de 50MP con OIS y carga rápida. Gama media-alta con gran relación valor/precio.`
    if (n.includes('POCO X7 PRO')) return `POCO ${model}. Procesador Dimensity 8400, pantalla AMOLED 120Hz, cámara de 50MP con OIS y carga de 90W.`
    if (n.includes('POCO X7')) return `POCO ${model}. Pantalla AMOLED 120Hz, cámara de 50MP, batería de 5110mAh y carga de 45W. Rendimiento fluido en gama media.`
    if (n.includes('POCO X6 PRO')) return `POCO ${model}. Procesador Dimensity 8300, pantalla AMOLED 120Hz, cámara de 64MP con OIS y carga de 67W.`
    if (n.includes('POCO X4 PRO')) return `POCO ${model}. Pantalla AMOLED 120Hz, cámara de 108MP, carga de 67W y diseño premium en gama media.`
    if (n.includes('POCO X3')) return `POCO ${model}. Pantalla IPS 120Hz, Snapdragon 732G, cámara de 64MP y batería de 5160mAh. Rendimiento sólido.`

    // Poco M series (mid-range)
    if (n.includes('POCO M8 PRO')) return `POCO ${model}. Pantalla AMOLED, cámara de 108MP, batería de 5000mAh y carga de 33W. Calidad de imagen superior en gama media.`
    if (n.includes('POCO M8')) return `POCO ${model}. Pantalla grande, cámara de alta resolución, batería de larga duración y rendimiento confiable.`
    if (n.includes('POCO M7 PRO')) return `POCO ${model}. Pantalla AMOLED, cámara de 50MP con OIS, batería de 5110mAh y carga de 45W.`
    if (n.includes('POCO M7')) return `POCO ${model}. Pantalla IPS, procesador Dimensity, cámara de 50MP y batería de 5160mAh. Gama media confiable.`
    if (n.includes('POCO M6')) return `POCO ${model}. Pantalla IPS, cámara de 64MP, batería de 5000mAh y diseño elegante. Gama media accesible.`
    if (n.includes('POCO M3')) return `POCO ${model}. Batería masiva de 6000mAh, pantalla IPS 6.53" y cámara de 48MP. AutonomíaExceptional para uso intensivo.`

    // Poco C series (entry-level)
    if (n.includes('POCO C85')) return `POCO ${model}. Entry-level con pantalla grande IPS, cámara confiable y batería de larga duración. Ideal como primer smartphone.`
    if (n.includes('POCO C71')) return `POCO ${model}. Smartphone entry-level con pantalla de 6.88", batería de 5160mAh y rendimiento básico confiable.`
    if (n.includes('POCO C65')) return `POCO ${model}. Pantalla IPS 6.74", cámara de 50MP y batería de 5000mAh. Entry-level con buena autonomía.`

    // Redmi Note series (mid-range)
    if (n.includes('XIAOMI NOTE 15 PRO PLUS') || n.includes('NOTE 15 PRO PLUS')) return `Xiaomi ${model}. Cámara principal de 200MP con OIS, pantalla AMOLED 1.5K 120Hz, Snapdragon 7s Gen 3, batería de 5110mAh y carga de 90W.`
    if (n.includes('NOTE 15 PRO')) return `Xiaomi ${model}. Cámara de 200MP con OIS, pantalla AMOLED 1.5K 120Hz, procesador Dimensity 8400 Ultra y carga de 90W.`
    if (n.includes('NOTE 15 5G')) return `Xiaomi ${model}. Pantalla AMOLED 120Hz, cámara de 108MP, conectividad 5G y batería de 5110mAh. Gama media con 5G.`
    if (n.includes('NOTE 15')) return `Xiaomi ${model}. Pantalla AMOLED 120Hz, cámara de alta resolución, batería de 5110mAh y rendimiento fluido.`
    if (n.includes('NOTE 14 PRO PLUS')) return `Xiaomi ${model}. Cámara de 200MP con OIS, pantalla AMOLED 1.5K 120Hz, Snapdragon 7s Gen 2 y carga de 90W.`
    if (n.includes('NOTE 14 PRO')) return `Xiaomi ${model}. Cámara de 50MP con OIS, pantalla AMOLED 120Hz, procesador Dimensity 7300 Ultra y carga de 45W.`
    if (n.includes('NOTE 14S')) return `Xiaomi ${model}. Pantalla AMOLED 120Hz, cámara de 108MP, batería de 5000mAh y carga de 33W. Gama media equilibrada.`
    if (n.includes('NOTE 14')) return `Xiaomi ${model}. Pantalla AMOLED 90Hz, cámara de 50MP, batería de 5500mAh y diseño actualizado.`
    if (n.includes('NOTE 13 PRO PLUS')) return `Xiaomi ${model}. Cámara de 200MP con OIS, pantalla AMOLED 1.5K 120Hz, IP68 resistencia al agua y carga de 120W.`
    if (n.includes('NOTE 13 PRO')) return `Xiaomi ${model}. Cámara de 200MP con OIS, pantalla AMOLED 120Hz, procesador Dimensity 7200 y carga de 67W.`
    if (n.includes('NOTE 13')) return `Xiaomi ${model}. Pantalla AMOLED 120Hz, cámara de 108MP, batería de 5000mAh y diseño delgado.`
    if (n.includes('NOTE 12 PRO PLUS')) return `Xiaomi ${model}. Cámara de 108MP con OIS, pantalla AMOLED 120Hz, carga de 120W y procesador Dimensity 900.`
    if (n.includes('NOTE 12 PRO')) return `Xiaomi ${model}. Cámara de 108MP, pantalla AMOLED 120Hz, batería de 5000mAh y carga de 67W.`
    if (n.includes('NOTE 12')) return `Xiaomi ${model}. Pantalla AMOLED 120Hz, cámara de 50MP, batería de 5000mAh y conectividad 5G.`
    if (n.includes('NOTE 11S')) return `Xiaomi ${model}. Cámara de 108MP, pantalla AMOLED 90Hz, batería de 5000mAh y carga de 33W.`
    if (n.includes('NOTE 11')) return `Xiaomi ${model}. Pantalla AMOLED 90Hz, Snapdragon 680, cámara de 50MP y batería de 5000mAh.`
    if (n.includes('NOTE 9S')) return `Xiaomi ${model}. Pantalla IPS 6.67" FHD+, Snapdragon 720G, cámara cuádruple de 48MP y batería de 5020mAh.`

    // Redmi numbered series (budget to mid-range)
    if (n.includes('REDMI 17')) return `Xiaomi ${model}. Pantalla IPS grande, procesador Snapdragon de gama media, cámara de alta resolución y batería de larga duración.`
    if (n.includes('REDMI 15C')) return `Xiaomi ${model}. Pantalla IPS 6.88", procesador Helio G81, cámara de 50MP y batería de 5160mAh. Entry-level con pantalla amplia.`
    if (n.includes('REDMI 15')) return `Xiaomi ${model}. Pantalla IPS 6.88", procesador Snapdragon 4 Gen 2, cámara de 108MP y batería de 5160mAh.`
    if (n.includes('REDMI 14C')) return `Xiaomi ${model}. Pantalla IPS 6.88", procesador Helio G81, cámara de 50MP y batería de 5160mAh. Entry-level confiable.`
    if (n.includes('REDMI 13')) return `Xiaomi ${model}. Pantalla IPS 6.79" FHD+, procesador Helio G88, cámara de 108MP y batería de 5030mAh.`
    if (n.includes('A7 PRO')) return `Xiaomi ${model}. Entry-level con pantalla IPS, procesador Helio, cámara mejorada y batería de larga duración.`
    if (n.includes('REDMI A7')) return `Xiaomi ${model}. Entry-level con pantalla IPS, procesador Helio, cámara básica y batería de larga duración. Funcional y accesible.`
    if (n.includes('REDMI A5')) return `Xiaomi ${model}. Smartphone entry-level con pantalla IPS 6.88", conectividad 5G, cámara de 13MP y batería de 5160mAh. Accesible y funcional.`
    if (n.includes('REDMI')) return `Xiaomi ${model}. Pantalla amplia, batería de larga duración y rendimiento confiable. Calidad Xiaomi a precio accesible.`

    // Samsung Galaxy S series (standalone without SAMSUNG prefix patterns)
    if (n.includes('S26 ULTRA') || n.includes('S25 ULTRA')) return `Samsung ${model}. Cámara de 200MP con zoom óptico 5x, pantalla Dynamic AMOLED 2X de 6.8", S Pen y batería todo el día.`
    if (n.includes('S26 PLUS') || n.includes('S25 PLUS')) return `Samsung ${model}. Pantalla Dynamic AMOLED 2X de 6.7", cámara triple con IA, rendimiento flagship y mayor batería.`
    if (n.includes('S26') || n.includes('S25 5G')) return `Samsung ${model}. Pantalla Dynamic AMOLED 2X, Snapdragon 8 Elite, cámara con IA y diseño premium compacto.`
    if (n.includes('S24 FE')) return `Samsung ${model}. Experiencia flagship accesible: pantalla AMOLED 6.7", Exynos 2400e, cámara de 50MP y 7 años de actualizaciones.`

    // Fallback
    return `Smartphone con especificaciones ver ficha técnica.`
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
      const imagenes = fixImage(p.sku, Array.isArray(p.imagenes) ? p.imagenes : p.image ? [p.image] : [], nombre, categoria)
      const especificaciones = p.especificaciones || (Array.isArray(p.specs) ? Object.fromEntries(p.specs.map(s => [s, s])) : {})
      const cleanSpecs = Object.fromEntries(Object.entries(especificaciones).filter(([k]) => !k.startsWith('_')))
      const descripcion = (p.descripcion && p.descripcion.length > 20 && !p.descripcion.toUpperCase().includes(nombre.toUpperCase().substring(0, 10))) ? p.descripcion : genDescripcion(nombre, categoria, cleanSpecs)
      // Dual pricing: transferencia and MercadoPago
      const precioBase = Number(p.precio ?? p.price ?? 0)
      const pt = Number(p.precio_transferencia) || 0
      const pm = Number(p.precio_mercadopago) || 0
      const precio_transferencia = pt || precioBase || 0
      const precio_mercadopago = pm || precioBase || 0
      return { ...p, nombre, name: nombre, precio: precio_transferencia, price: precio_transferencia, precio_transferencia, precio_mercadopago, marca, brand: marca, categoria, category: categoria, imagenes, image: imagenes[0] || null, especificaciones: cleanSpecs, specs: Object.values(cleanSpecs), tipo_venta: p.tipo_venta || 'directa', stock: p.tipo_venta === 'encargo' ? null : Number(p.stock ?? 0), descripcion, estado: p.estado || 'activo', moneda: p.moneda || 'ARS', fuente_origen: p.fuente_origen || 'manual' }
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
      precio_transferencia: Number(data.precio_transferencia) || precio,
      precio_mercadopago: Number(data.precio_mercadopago) || precio,
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
    const order = { id: genId(), code, customer_name: customer.name?.trim(), email: customer.email?.trim(), phone: customer.phone || '', city: customer.city || '', address: customer.address || '', payment_method: customer.paymentMethod || 'transferencia', subtotal, shipping, total, status: 'pendiente', created_at: new Date().toISOString(), items: resolved }
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
  updateOrderPatch(id, patch) {
    const o = orders.find(x=> String(x.id)===String(id))
    if (!o) return false
    Object.assign(o, patch)
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
