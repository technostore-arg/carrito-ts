/**
 * @technostore/catalog-schema — Esquema único de producto
 * TechnoStore + Futuro Hard comparten este módulo.
 * Fuente de verdad para frontends, admin y pipeline de ingesta (Fase 7).
 */

// ── Enums ──────────────────────────────────────────────────────────
export const MARCAS = ["technostore", "futurohard"]
export const TIPOS_VENTA = ["directa", "encargo"]
export const ESTADOS = ["activo", "pausado", "agotado"]
export const FUENTES = ["manual", "archivo_normalizado", "scraping"]
export const MONEDAS = ["ARS", "USD"]

export const CATEGORIAS = {
  technostore: ["celulares", "notebooks", "computadoras", "accesorios"],
  futurohard: ["gpus", "memorias", "workstations", "accesorios"],
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * @typedef {"technostore"|"futurohard"} Marca
 * @typedef {"directa"|"encargo"} TipoVenta
 * @typedef {"activo"|"pausado"|"agotado"} Estado
 * @typedef {"manual"|"archivo_normalizado"|"scraping"} FuenteOrigen
 *
 * @typedef {Object} Producto
 * @property {string|null} id             — Firestore doc id (null antes de persistir)
 * @property {string} sku                 — único, ej. "TS-RTX4090-24G"
 * @property {string} nombre
 * @property {string} descripcion
 * @property {Marca} marca                — a qué vidriera pertenece
 * @property {string} categoria
 * @property {string} subcategoria
 * @property {TipoVenta} tipo_venta
 * @property {number} precio              — 0 permitido solo si encargo
 * @property {"ARS"|"USD"} moneda
 * @property {number|null} stock          — null si encargo (no aplica)
 * @property {Record<string, string|number>} especificaciones — flexible clave-valor
 * @property {string[]} imagenes          — URLs absolutas (storage o externas)
 * @property {FuenteOrigen} fuente_origen
 * @property {Estado} estado
 * // Campos opcionales específicos Futuro Hard / legacy
 * @property {number|null} [vram]
 * @property {number|null} [cuda]
 * @property {number|null} [tflops]
 * @property {string[]} [frameworks]
 * @property {number} [rating]
 * @property {number} [reviews]
 * @property {string} [createdAt]         — ISO
 * @property {string} [updatedAt]         — ISO
 */

const nowISO = () => new Date().toISOString()

// ── Validación ─────────────────────────────────────────────────────
/**
 * Valida un producto ya normalizado.
 * @param {Partial<Producto>} p
 * @returns {string[]} errores vacíos = válido
 */
export function validarProducto(p) {
  const e = []
  if (!p.nombre || String(p.nombre).trim().length < 3) e.push("nombre: mínimo 3 caracteres")
  if (!p.sku || String(p.sku).trim().length < 2) e.push("sku: requerido, ej. TS-XXXX")
  if (!MARCAS.includes(p.marca)) e.push(`marca: debe ser ${MARCAS.join(" | ")}`)
  if (!p.categoria || !String(p.categoria).trim()) e.push("categoria: requerida")
  if (!TIPOS_VENTA.includes(p.tipo_venta)) e.push(`tipo_venta: ${TIPOS_VENTA.join(" | ")}`)
  if (!ESTADOS.includes(p.estado)) e.push(`estado: ${ESTADOS.join(" | ")}`)
  if (!FUENTES.includes(p.fuente_origen)) e.push(`fuente_origen: ${FUENTES.join(" | ")}`)

  if (p.tipo_venta === "directa") {
    if (!(Number(p.precio) > 0)) e.push("precio: > 0 requerido para directa")
    if (p.stock == null || Number.isNaN(Number(p.stock)) || Number(p.stock) < 0)
      e.push("stock: número >= 0 requerido para directa")
  } else {
    if (p.stock != null) e.push("stock: debe ser null para encargo")
  }

  if (p.imagenes && !Array.isArray(p.imagenes)) e.push("imagenes: debe ser array de URLs")
  if (p.especificaciones && typeof p.especificaciones !== "object") e.push("especificaciones: objeto clave-valor")

  return e
}

// ── Normalización ──────────────────────────────────────────────────
/**
 * Convierte un objeto crudo (archivo, scraping, form manual) al esquema canónico.
 * Tolera alias en inglés/español y completa defaults.
 * @param {any} raw
 * @returns {Producto}
 */
function getField(raw, keys) {
  // Búsqueda case-insensitive, con normalización de acentos y espacios
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const map = new Map(Object.entries(raw).map(([k, v]) => [norm(k), v]))
  for (const k of keys) if (map.has(norm(k))) return map.get(norm(k))
  return undefined
}

export function normalizarProducto(raw = {}) {
  const tipo_venta = TIPOS_VENTA.includes(raw.tipo_venta) || TIPOS_VENTA.includes(getField(raw, ['tipo_venta','tipoVenta']))
    ? (TIPOS_VENTA.includes(raw.tipo_venta) ? raw.tipo_venta : getField(raw, ['tipo_venta','tipoVenta']))
    : TIPOS_VENTA.includes(raw.tipoVenta)
      ? raw.tipoVenta
      : "directa"

  const esEncargo = tipo_venta === "encargo"

  return {
    id: raw.id ?? getField(raw, ['id']) ?? null,
    sku: String(raw.sku ?? raw.SKU ?? getField(raw, ['sku','codigo','cod','code','id','articulo']) ?? raw.id ?? "").trim().toUpperCase(),
    nombre: String(raw.nombre ?? raw.name ?? getField(raw, ['nombre','name','descripcion','description','producto','articulo','titulo','title']) ?? "").trim(),
    descripcion: String(raw.descripcion ?? raw.description ?? getField(raw, ['descripcion','description','detalle','observaciones','producto']) ?? "").trim(),
    marca: MARCAS.includes(raw.marca) ? raw.marca : MARCAS.includes(getField(raw, ['marca','brand'])) ? getField(raw, ['marca','brand']) : "technostore",
    categoria: String(raw.categoria ?? raw.category ?? getField(raw, ['categoria','category','rubro','familia','grupo','tipo']) ?? "").trim().toLowerCase(),
    subcategoria: String(raw.subcategoria ?? raw.subCategory ?? getField(raw, ['subcategoria','subcategory']) ?? "").trim(),
    tipo_venta,
    precio: Number(raw.precio ?? raw.price ?? getField(raw, ['precio','price','preciolista','precio_lista','importe','valor','cost','costo','pvp']) ?? 0),
    moneda: MONEDAS.includes(raw.moneda) ? raw.moneda : MONEDAS.includes(getField(raw, ['moneda','currency'])) ? getField(raw, ['moneda','currency']) : "ARS",
    stock: esEncargo ? null : Number(raw.stock ?? getField(raw, ['stock','cantidad','qty','quantity','disponible','existencia']) ?? 0),
    especificaciones:
      raw.especificaciones ?? raw.specs ?? raw.specsTecnicas ?? raw.especificacoes ?? {},
    imagenes: Array.isArray(raw.imagenes)
      ? raw.imagenes
      : Array.isArray(raw.imagenes_urls)
        ? raw.imagenes_urls
        : Array.isArray(raw.images)
          ? raw.images
          : raw.image
            ? [raw.image]
            : raw.imagen
              ? [raw.imagen]
              : [],
    fuente_origen: FUENTES.includes(raw.fuente_origen) ? raw.fuente_origen : "manual",
    estado: ESTADOS.includes(raw.estado) ? raw.estado : "activo",
    vram: raw.vram ?? null,
    cuda: raw.cuda ?? null,
    tflops: raw.tflops ?? null,
    frameworks: Array.isArray(raw.frameworks) ? raw.frameworks : [],
    rating: Number(raw.rating ?? 4.5),
    reviews: Number(raw.reviews ?? 0),
    createdAt: raw.createdAt ?? nowISO(),
    updatedAt: nowISO(),
  }
}

// ── Fábricas de ejemplo ────────────────────────────────────────────
export function crearProductoDirecta(overrides = {}) {
  return normalizarProducto({
    sku: "TS-DEMO-001",
    nombre: "Producto de muestra",
    descripcion: "Descripción corta",
    marca: "technostore",
    categoria: "accesorios",
    tipo_venta: "directa",
    precio: 99999,
    stock: 10,
    estado: "activo",
    fuente_origen: "manual",
    ...overrides,
  })
}

export function crearProductoEncargo(overrides = {}) {
  return normalizarProducto({
    sku: "FH-RTX-4090-24G",
    nombre: "RTX 4090 24GB — a pedido",
    marca: "futurohard",
    categoria: "gpus",
    tipo_venta: "encargo",
    precio: 0,
    estado: "activo",
    fuente_origen: "scraping",
    especificaciones: { vram: "24GB", tflops: "82", compatibilidad: "CUDA 12" },
    ...overrides,
    stock: null,
  })
}

// ── Firestore helpers (Fase 7) ─────────────────────────────────────
/**
 * Converter para usar con Firestore:
 *   docRef.withConverter(productoConverter)
 */
export const productoConverter = {
  toFirestore(producto) {
    const { id, ...data } = producto
    return data
  },
  fromFirestore(snapshot, options) {
    const data = snapshot.data(options)
    return { id: snapshot.id, ...data }
  },
}

/**
 * Resumen de ingesta para el preview antes de aplicar (Fase 7).
 * @typedef {{ altas: number, bajas: number, cambiosPrecio: number, sinCambios: number, ejemplos: any[] }} ResumenIngesta
 */
export function resumirIngesta({ existentes = [], normalizados = [] } = {}) {
  const porSkuExistente = new Map(existentes.map(p => [p.sku, p]))
  let altas = 0, cambiosPrecio = 0, sinCambios = 0
  for (const n of normalizados) {
    const e = porSkuExistente.get(n.sku)
    if (!e) altas++
    else if (Number(e.precio) !== Number(n.precio)) cambiosPrecio++
    else sinCambios++
  }
  const porSkuNuevo = new Set(normalizados.map(p => p.sku))
  const bajas = existentes.filter(p => !porSkuNuevo.has(p.sku)).length
  return { altas, bajas, cambiosPrecio, sinCambios, ejemplos: normalizados.slice(0, 3) }
}
