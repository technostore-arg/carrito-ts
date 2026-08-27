/**
 * apps/admin/src/data/adapter.js
 * Adaptador desacoplado — hoy mock local, mañana Firebase/Firestore.
 * Los componentes SOLO importan de acá; para migrar a Firebase basta
 * reemplazar el cuerpo de cada función por llamadas a Firestore/REST
 * manteniendo la misma firma.
 */
import { mockProductos, mockPedidos, mockConsultas, mockVistas } from './mockData.js'

const delay = (ms = 180) => new Promise(r => setTimeout(r, ms))

let productos = [...mockProductos]
let pedidos = [...mockPedidos]
let consultas = [...mockConsultas]

function uid(prefix = 'p') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export async function listProductos({ marca, q, tipo_venta, estado } = {}) {
  await delay()
  let out = [...productos]
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
  await delay()
  const p = { id: uid('p'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data }
  productos.unshift(p)
  return p
}

export async function updateProducto(id, patch) {
  await delay()
  const i = productos.findIndex(p => p.id === id)
  if (i === -1) throw new Error('Producto no encontrado')
  productos[i] = { ...productos[i], ...patch, updatedAt: new Date().toISOString() }
  return productos[i]
}

export async function deleteProducto(id) {
  await delay()
  const i = productos.findIndex(p => p.id === id)
  if (i === -1) throw new Error('Producto no encontrado')
  productos.splice(i, 1)
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
  const porMarca = {
    technostore: { productos: productos.filter(p => p.marca === 'technostore').length, ventas: ventasPeriodo.filter(o => o.items?.some(it => productos.find(p => p.id === it.producto_id)?.marca === 'technostore')).length, consultas: consultas.filter(c => c.marca === 'technostore').length },
    futurohard: { productos: productos.filter(p => p.marca === 'futurohard').length, ventas: ventasPeriodo.filter(o => o.items?.some(it => productos.find(p => p.id === it.producto_id)?.marca === 'futurohard') || o.items?.some(it => (it.nombre || '').includes('RTX') || (it.nombre || '').includes('Rig'))).length, consultas: consultas.filter(c => c.marca === 'futurohard').length },
  }
  const correctFHVentas = ventasPeriodo.filter(o => {
    const hasFH = o.items?.some(it => {
      const prod = productos.find(pr => pr.id === it.producto_id)
      if (prod) return prod.marca === 'futurohard'
      return ['RTX','Rig','NVMe','DDR5','Workstation'].some(k => (it.nombre||'').includes(k))
    })
    return hasFH
  }).length
  porMarca.futurohard.ventas = correctFHVentas
  porMarca.technostore.ventas = ventasPeriodo.length - correctFHVentas
  return { vistas, abiertas, ventasPeriodo, totalVentas, porMarca, totalConsultas: consultas.length, totalPedidos: pedidos.length }
}

export function resetMocks() {
  productos = [...mockProductos]
  pedidos = [...mockPedidos]
  consultas = [...mockConsultas]
}
