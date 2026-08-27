import { useEffect, useState } from 'react'
import { listPedidos, updatePedido, listConsultas, updateConsulta } from '../data/adapter.js'

const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
const fmtDate = iso => { try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) } catch { return iso } }
const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado']

export default function Orders() {
  const [subtab, setSubtab] = useState('directas')
  const [pedidos, setPedidos] = useState([])
  const [consultas, setConsultas] = useState([])
  const [fEstado, setFEstado] = useState('')

  const load = async () => {
    const [p, c] = await Promise.all([listPedidos({ status: fEstado || undefined }), listConsultas()])
    setPedidos(p); setConsultas(c)
  }
  useEffect(() => { load() }, [fEstado])
  useEffect(() => { if (subtab === 'consultas') load() }, [subtab])

  const setEstado = async (o, status) => {
    await updatePedido(o.id, { status })
    load()
  }
  const toggleCierre = async c => {
    const next = c.estado_cierre === 'abierta' ? 'cerrada' : 'abierta'
    await updateConsulta(c.id, { estado_cierre: next })
    load()
  }
  const toggleVenta = async c => {
    await updateConsulta(c.id, { venta_cerrada: !c.venta_cerrada, estado_cierre: !c.venta_cerrada ? 'cerrada' : c.estado_cierre })
    load()
  }

  return (
    <div className="stack">
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button className={subtab === 'directas' ? 'seg-active' : ''} onClick={() => setSubtab('directas')}>🧾 Compras directas ({pedidos.length})</button>
        <button className={subtab === 'consultas' ? 'seg-active' : ''} onClick={() => setSubtab('consultas')}>💬 Consultas WhatsApp ({consultas.length})</button>
      </div>

      {subtab === 'directas' && (
        <>
          <div className="toolbar">
            <select value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="muted" style={{ fontSize: '.85rem' }}>{pedidos.length} pedidos</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Cliente</th><th>Items</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {pedidos.length === 0 ? <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin pedidos</td></tr>
                  : pedidos.map(o => (
                    <tr key={o.id}>
                      <td><code className="sku">{o.code}</code></td>
                      <td><b>{o.customer_name}</b><br /><small className="muted">{o.email} · {o.city}</small></td>
                      <td><small>{o.items?.map(it => `${it.nombre} ×${it.qty}`).join(' · ')}</small></td>
                      <td>{fmt(o.total)}</td>
                      <td><span className={`pill ${o.status}`}>{o.status}</span></td>
                      <td><small>{fmtDate(o.created_at)}</small></td>
                      <td>
                        <select value={o.status} onChange={e => setEstado(o, e.target.value)} className="select-sm">
                          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subtab === 'consultas' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>SKU / Producto</th><th>Marca</th><th>Teléfono</th><th>Mensaje</th><th>Fecha</th><th>Cierre</th><th>Venta</th><th></th></tr></thead>
            <tbody>
              {consultas.length === 0 ? <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin consultas — aparecen al hacer clic en "Consultar por WhatsApp" en productos encargo</td></tr>
                : consultas.map(c => (
                  <tr key={c.id}>
                    <td><code className="sku">{c.sku}</code><br /><small>{c.nombre}</small></td>
                    <td><span className={`pill ${c.marca}`}>{c.marca}</span></td>
                    <td><small>{c.telefono || '—'}</small></td>
                    <td style={{ maxWidth: 260 }}><small>{c.mensaje}</small></td>
                    <td><small>{fmtDate(c.createdAt)}</small></td>
                    <td><span className={`pill ${c.estado_cierre}`}>{c.estado_cierre}</span></td>
                    <td>{c.venta_cerrada ? '✅ sí' : '—'}</td>
                    <td className="row-actions">
                      <button className="btn-sm" onClick={() => toggleCierre(c)}>{c.estado_cierre === 'abierta' ? 'Cerrar' : 'Reabrir'}</button>
                      <button className={`btn-sm ${c.venta_cerrada ? 'danger' : ''}`} onClick={() => toggleVenta(c)}>{c.venta_cerrada ? 'Desmarcar venta' : 'Venta cerrada'}</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
