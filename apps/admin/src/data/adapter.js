/**
 * apps/admin/src/data/adapter.js
 * Adaptador desacoplado — hoy mock local, mañana Firebase/Firestore.
 * Los componentes SOLO importan de acá; para migrar a Firebase basta
 * reemplazar el cuerpo de cada función por llamadas a Firestore/REST
 * manteniendo la misma firma.
 */
import { mockPedidos, mockConsultas, mockVistas } from './mockData.js'

const delay = (ms = 180) => new Promise(r => setTimeout(r, ms))

let pedidos = [...mockPedidos]
let consultas = [...mockConsultas]

function authHeader() {
  const tok = sessionStorage.getItem('admin_tok')
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function toAdminProduct(p) {
  // API returns both ES and EN keys; normalize for admin table
  return {
    id: p.id,
    sku: p.sku || p.SKU || '',
    nombre: p.nombre || p.name || '',
    descripcion: p.descripcion || p.description || '',
    marca: p.marca || p.brand || 'technostore',
    categoria: p.categoria || p.category || '',
    subcategoria: p.subcategoria || '',
    tipo_venta: p.tipo_venta || 'directa',
    precio: Number(p.precio ?? p.price ?? 0),
    price: Number(p.precio ?? p.price ?? 0),
    stock: p.stock ?? null,
    estado: p.estado || (p.active === false ? 'pausado' : 'activo'),
    moneda: p.moneda || 'ARS',
    fuente_origen: p.fuente_origen || 'manual',
    especificaciones: p.especificaciones || {},
    imagenes: p.imagenes || (p.image ? [p.image] : []),
    image: p.image || (Array.isArray(p.imagenes) ? p.imagenes[0] : null),
    active: p.active !== false,
  }
}

export async function listProductos({ marca, q, tipo_venta, estado } = {}) {
  const r = await fetch('/api/products')
  if (!r.ok) throw new Error(`No se pudo listar productos (${r.status})`)
  let out = (await r.json()).map(toAdminProduct)
  if (marca && marca !== 'todas') out = out.filter(p => p.marca === marca)
  if (tipo_venta) out = out.filter(p => p.tipo_venta === tipo_venta)
  if (estado) out = out.filter(p => p.estado === estado)
  if (q) {
    const s = q.toLowerCase()
    out = out.filter(p => `${p.sku} ${p.nombre} ${p.categoria}`.toLowerCase().includes(s))
  }
  return out
}

export async function createProducto(data) {
  const r = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ ...data, nombre: data.nombre, categoria: data.categoria, precio: data.precio }),
  })
  if (!r.ok) throw new Error((await r.json()).error || 'No se pudo crear producto')
  return toAdminProduct(await r.json())
}

export async function updateProducto(id, patch) {
  const r = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error((await r.json()).error || 'No se pudo actualizar')
  return toAdminProduct(await r.json())
}

export async function deleteProducto(id) {
  const r = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!r.ok) throw new Error((await r.json()).error || 'No se pudo eliminar')
}

export async function listPedidos({ status } = {}) {
  await delay()
  let out = [...pedidos]
  if (status) out = out.filter(o => o.status === status)
  out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return out
}

export async function updatePedido(id, patch) {
  await delay()
  const i = pedidos.findIndex(o => o.id === id)
  if (i === -1) throw new Error('Pedido no encontrado')
  pedidos[i] = { ...pedidos[i], ...patch }
  return pedidos[i]
}

export async function listConsultas({ estado_cierre } = {}) {
  await delay()
  let out = [...consultas]
  if (estado_cierre) out = out.filter(c => c.estado_cierre === estado_cierre)
  out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return out
}

export async function updateConsulta(id, patch) {
  await delay()
  const i = consultas.findIndex(c => c.id === id)
  if (i === -1) throw new Error('Consulta no encontrada')
  consultas[i] = { ...consultas[i], ...patch }
  return consultas[i]
}

export async function getVistas() {
  await delay(80)
  return [...mockVistas].sort((a, b) => b.vistas - a.vistas)
}

export async function getMetricas() {
  await delay(80)
  const vistas = [...mockVistas].sort((a, b) => b.vistas - a.vistas)
  const abiertas = consultas.filter(c => c.estado_cierre === 'abierta')
  const ventasPeriodo = pedidos.filter(o => o.status !== 'cancelado')
  const totalVentas = ventasPeriodo.reduce((s, o) => s + (o.total || 0), 0)
  let productosReales = []
  try { productosReales = await listProductos() } catch { productosReales = [] }
  const porMarca = {
    technostore: { productos: productosReales.filter(p => p.marca === 'technostore').length, ventas: 0, consultas: consultas.filter(c => c.marca === 'technostore').length },
    futurohard: { productos: productosReales.filter(p => p.marca === 'futurohard').length, ventas: 0, consultas: consultas.filter(c => c.marca === 'futurohard').length },
  }
  const correctFHVentas = ventasPeriodo.filter(o => {
    const hasFH = o.items?.some(it => {
      const prod = productosReales.find(pr => pr.id === it.producto_id)
      if (prod) return prod.marca === 'futurohard'
      return ['RTX','Rig','NVMe','DDR5','Workstation'].some(k => (it.nombre||'').includes(k))
    })
    return hasFH
  }).length
  porMarca.futurohard.ventas = correctFHVentas
  porMarca.technostore.ventas = ventasPeriodo.length - correctFHVentas
  return { vistas, abiertas, ventasPeriodo, totalVentas, porMarca, totalConsultas: consultas.length, totalPedidos: pedidos.length }
}

export async function listBorradores({ estado } = {}) {
  const q = estado ? `?estado=${encodeURIComponent(estado)}` : ''
  const r = await fetch(`/api/borradores${q}`)
  if (!r.ok) throw new Error('No se pudo listar borradores')
  return r.json()
}
export async function aplicarBorrador(id, skus) {
  const r = await fetch(`/api/borradores/${id}/aplicar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skus }) })
  if (!r.ok) throw new Error((await r.json()).error || 'Error al aplicar')
  return r.json()
}

export function resetMocks() {
  // productos now come from API — nothing to reset locally
  pedidos = [...mockPedidos]
  consultas = [...mockConsultas]
}
