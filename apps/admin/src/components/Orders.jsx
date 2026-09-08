import { useEffect, useState } from 'react'
import { listPedidos, updatePedido, listConsultas, updateConsulta } from '../data/adapter.js'

const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
const fmtDate = iso => { try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) } catch { return iso } }

const ESTADOS_ENVIO = ['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado']
const ESTADOS_RETIRO = ['pendiente', 'pagado', 'listo_para_retirar', 'retirado', 'cancelado']
const METODOS_PAGO = { mercadopago: 'MercadoPago', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }
const TIPO_ENTREGA = { envio: 'Envío', retiro: 'Retiro' }

export default function Orders() {
  const [subtab, setSubtab] = useState('directas')
  const [pedidos, setPedidos] = useState([])
  const [consultas, setConsultas] = useState([])
  const [fEstado, setFEstado] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingNotes, setEditingNotes] = useState(null)
  const [notesValue, setNotesValue] = useState('')

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

  const saveNotes = async (o) => {
    await updatePedido(o.id, { notes: notesValue })
    setEditingNotes(null)
    load()
  }

  const startEditNotes = (o) => {
    setEditingNotes(o.id)
    setNotesValue(o.notes || '')
  }

  const getEstados = (o) => o.tipo_entrega === 'retiro' ? ESTADOS_RETIRO : ESTADOS_ENVIO

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
        <button className={subtab === 'directas' ? 'seg-active' : ''} onClick={() => setSubtab('directas')}>Compras directas ({pedidos.length})</button>
        <button className={subtab === 'consultas' ? 'seg-active' : ''} onClick={() => setSubtab('consultas')}>Consultas WhatsApp ({consultas.length})</button>
      </div>

      {subtab === 'directas' && (
        <>
          <div className="toolbar">
            <select value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {['pendiente', 'pagado', 'preparando', 'enviado', 'entregado', 'pendiente_verificacion', 'listo_para_retirar', 'retirado', 'cancelado'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="muted" style={{ fontSize: '.85rem' }}>{pedidos.length} pedidos</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Cliente</th><th>Pago</th><th>Entrega</th><th>Items</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {pedidos.length === 0 ? <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin pedidos</td></tr>
                  : pedidos.map(o => {
                    const estados = getEstados(o)
                    const isExpanded = expandedId === o.id
                    const needsVerification = o.status === 'pendiente_verificacion' || o.estadoPago === 'pendiente_verificacion'
                    return (
                      <>
                        <tr key={o.id} style={needsVerification ? { background: '#fff8e1' } : {}}>
                          <td><code className="sku">{o.code}</code></td>
                          <td><b>{o.customer_name}</b><br /><small className="muted">{o.email} · {o.phone || o.city}</small></td>
                          <td><span className={`pill ${o.payment_method}`}>{METODOS_PAGO[o.payment_method] || o.payment_method || '—'}</span></td>
                          <td><span className={`pill ${o.tipo_entrega || 'envio'}`}>{TIPO_ENTREGA[o.tipo_entrega] || 'Envío'}</span></td>
                          <td><small>{o.items?.map(it => `${it.nombre || it.name} ×${it.qty}`).join(' · ')}</small></td>
                          <td>{fmt(o.total)}</td>
                          <td><span className={`pill ${o.status}`}>{(o.status || '').replace(/_/g, ' ')}</span></td>
                          <td><small>{fmtDate(o.created_at)}</small></td>
                          <td className="row-actions">
                            <select value={o.status} onChange={e => setEstado(o, e.target.value)} className="select-sm">
                              {estados.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                            <button className="btn-sm" onClick={() => setExpandedId(isExpanded ? null : o.id)}>{isExpanded ? 'Cerrar' : 'Detalle'}</button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${o.id}-detail`}>
                            <td colSpan={9} style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #eee' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                  <b style={{ fontSize: 12, color: 'var(--muted)' }}>DIRECCIÓN</b>
                                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>{o.address || 'Sin dirección'}{o.city ? `, ${o.city}` : ''}</p>
                                </div>
                                <div>
                                  <b style={{ fontSize: 12, color: 'var(--muted)' }}>NOTAS INTERNAS</b>
                                  {editingNotes === o.id ? (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                      <input value={notesValue} onChange={e => setNotesValue(e.target.value)} placeholder="Nota para el equipo…" style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd' }} />
                                      <button className="btn-sm" onClick={() => saveNotes(o)}>OK</button>
                                      <button className="btn-sm" onClick={() => setEditingNotes(null)}>Cancelar</button>
                                    </div>
                                  ) : (
                                    <p style={{ margin: '4px 0 0', fontSize: 13, cursor: 'pointer' }} onClick={() => startEditNotes(o)}>
                                      {o.notes || <span className="muted">Click para agregar nota…</span>}
                                    </p>
                                  )}
                                </div>
                                {o.tracking && (
                                  <div>
                                    <b style={{ fontSize: 12, color: 'var(--muted)' }}>TRACKING</b>
                                    <p style={{ margin: '4px 0 0', fontSize: 13 }}>{o.tracking}</p>
                                  </div>
                                )}
                                {needsVerification && o.comprobanteUrl && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <b style={{ fontSize: 12, color: 'var(--muted)' }}>COMPROBANTE DE PAGO</b>
                                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                      {o.comprobanteUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                        <a href={o.comprobanteUrl} target="_blank" rel="noreferrer">
                                          <img src={o.comprobanteUrl} alt="Comprobante" style={{ maxHeight: 120, borderRadius: 8, border: '1px solid #ddd' }} />
                                        </a>
                                      ) : (
                                        <a href={o.comprobanteUrl} target="_blank" rel="noreferrer" className="btn-sm">Ver comprobante</a>
                                      )}
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn-sm" style={{ background: '#2e7d32', color: '#fff' }} onClick={async () => { await updatePedido(o.id, { status: 'pagado', estadoPago: 'pagado' }); load() }}>
                                          Aprobar pago
                                        </button>
                                        <button className="btn-sm danger" onClick={async () => {
                                          const motivo = prompt('Motivo del rechazo (opcional):')
                                          await updatePedido(o.id, { status: 'cancelado', notes: motivo ? `Pago rechazado: ${motivo}` : 'Pago rechazado' })
                                          load()
                                        }}>
                                          Rechazar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
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
                    <td>{c.venta_cerrada ? '✓ sí' : '—'}</td>
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
