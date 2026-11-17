/**
 * Separación static/dynamic del catálogo.
 *
 * - Estático (cacheable): nombre, fotos, descripción, especificaciones.
 * - Dinámico (no cacheable): precio y stock. Hoy se sirve desde nuestra API;
 *   cuando se conecten mayoristas, solo cambia `fetchLiveQuotes`.
 */
import { ars } from '../utils/format.js'

/**
 * @param {object} p Producto de /api/products
 * @returns {{static:object, dynamic:object}}
 */
export function splitProduct(p) {
  return {
    static: {
      id: p.id,
      sku: p.sku || p.id,
      nombre: p.nombre || p.name || '',
      marca: p.marca || p.brand || '',
      categoria: p.categoria || p.category || '',
      descripcion: p.descripcion || p.description || '',
      imagenes: Array.isArray(p.imagenes) ? p.imagenes : p.image ? [p.image] : [],
      especificaciones: p.especificaciones || {},
      condicion: p.condicion || 'nuevo',
      garantia: p.garantia ?? null,
      tipo_venta: p.tipo_venta || 'directa',
      badge: p.badge ?? null,
      rating: p.rating ?? 4.5,
    },
    dynamic: {
      precio_transferencia: p.precio_transferencia ?? p.precio ?? 0,
      precio_mercadopago: p.precio_mercadopago ?? p.precio ?? 0,
      precio_lista: p.precio_lista ?? null,
      stock: p.stock ?? 0,
      stock_source: p.stock_source || (p.fuente_origen === 'scraping_insumosacuario' ? 'supplier' : 'local'),
      updatedAt: p.updatedAt || null,
    },
  }
}

/** Carga del catálogo base (respuesta cacheable del servidor). */
export async function fetchStaticCatalog() {
  const res = await fetch('/api/products')
  if (!res.ok) throw new Error('No se pudo cargar el catálogo')
  const data = await res.json()
  if (!Array.isArray(data)) return []
  // Dedupe por SKU: TechnoStore y FuturoHard pueden compartir código.
  const seen = new Set()
  const out = []
  for (const p of data) {
    const key = String(p.sku || p.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/**
 * Precios/stock en tiempo real. La respuesta NO se cachea.
 * @param {string[]} skus
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchLiveQuotes(skus) {
  const ids = [...new Set((skus || []).map(String).filter(Boolean))].slice(0, 200)
  if (!ids.length) return {}
  try {
    const res = await fetch('/api/products/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus: ids }),
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data?.quotes || {}
  } catch {
    return {}
  }
}

/** @param {object[]} products @param {Record<string, object>} quotes */
export function mergeQuotes(products, quotes) {
  if (!quotes || !Object.keys(quotes).length) return products
  return products.map(p => {
    const sku = String(p.sku || p.id)
    const q = quotes[sku]
    if (!q) return p
    return { ...p, ...q, sku }
  })
}

export { ars }
