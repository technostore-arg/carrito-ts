export const MARCAS = ["technostore", "futurohard"]
export const TIPOS_VENTA = ["directa", "encargo"]
export const ESTADOS = ["activo", "pausado", "agotado"]
export const FUENTES = ["manual", "archivo_normalizado", "scraping"]
export const CATEGORIAS = {
  technostore: ["celulares", "notebooks", "computadoras", "accesorios"],
  futurohard: ["gpus", "memorias", "workstations", "accesorios"],
}
export function validarProducto(p) {
  const e = []
  if (!p.nombre || String(p.nombre).trim().length < 3) e.push("nombre inválido")
  if (!p.sku || String(p.sku).trim().length < 2) e.push("sku inválido")
  if (!MARCAS.includes(p.marca)) e.push("marca inválida")
  if (!TIPOS_VENTA.includes(p.tipo_venta)) e.push("tipo_venta inválido")
  if (p.tipo_venta === "directa" && !(Number(p.precio) > 0)) e.push("precio inválido para directa")
  if (!ESTADOS.includes(p.estado)) e.push("estado inválido")
  return e
}
export function normalizarProducto(raw) {
  return {
    id: raw.id ?? null,
    sku: String(raw.sku ?? raw.id ?? "").trim().toUpperCase(),
    nombre: String(raw.nombre ?? raw.name ?? "").trim(),
    descripcion: String(raw.descripcion ?? raw.description ?? "").trim(),
    marca: MARCAS.includes(raw.marca) ? raw.marca : "technostore",
    categoria: String(raw.categoria ?? raw.category ?? "").trim().toLowerCase(),
    subcategoria: String(raw.subcategoria ?? "").trim(),
    tipo_venta: TIPOS_VENTA.includes(raw.tipo_venta) ? raw.tipo_venta : "directa",
    precio: Number(raw.precio ?? raw.price ?? 0),
    moneda: raw.moneda ?? "ARS",
    stock: raw.tipo_venta === "encargo" ? null : Number(raw.stock ?? 0),
    especificaciones: raw.especificaciones ?? raw.specs ?? {},
    imagenes: Array.isArray(raw.imagenes) ? raw.imagenes : raw.image ? [raw.image] : [],
    fuente_origen: FUENTES.includes(raw.fuente_origen) ? raw.fuente_origen : "manual",
    estado: ESTADOS.includes(raw.estado) ? raw.estado : "activo",
    vram: raw.vram ?? null,
    cuda: raw.cuda ?? null,
    tflops: raw.tflops ?? null,
    frameworks: Array.isArray(raw.frameworks) ? raw.frameworks : [],
    rating: Number(raw.rating ?? 4.5),
    reviews: Number(raw.reviews ?? 0),
  }
}
