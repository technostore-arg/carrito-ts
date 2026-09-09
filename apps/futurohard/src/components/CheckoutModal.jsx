import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { ars } from '../utils/format'

export default function CheckoutModal({ onClose }) {
  const { detailed, shipping, total, clearCart } = useCart()
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', direccion: '', ciudad: 'CABA', pago: 'transferencia', tipoEntrega: 'envio' })
  const [comprobante, setComprobante] = useState(null)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)
  const setF = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const submit = async e => {
    e.preventDefault()
    setError(null); setSending(true)
    try {
      const payload = {
        customer: { name: form.nombre, email: form.email, phone: form.telefono, city: form.ciudad, address: form.direccion, paymentMethod: form.pago, tipoEntrega: form.tipoEntrega },
        items: detailed.map(p => ({ id: p.sku || p.id, qty: p.qty })),
      }
      const orderRes = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const orderData = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok) throw new Error(orderData.error || 'Error al crear pedido')

      if (form.pago === 'transferencia' && comprobante) {
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]
          await fetch('/api/comprobantes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderCode: orderData.code, customerName: form.nombre, comprobanteData: base64 })
          }).catch(() => {})
        }
        reader.readAsDataURL(comprobante)
      }

      setOrder({ code: orderData.code, metodo: form.pago }); clearCart()
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : err.message)
    } finally { setSending(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Cerrar">✕</button>
        {order ? (
          <div className="success">
            <span className="success-icon">✓</span>
            <h3>¡Pedido registrado!</h3>
            <p>Gracias <b>{form.nombre}</b>. Confirmación a <b>{form.email}</b>.</p>
            <div className="order-code">Orden: <code>{order.code}</code></div>
            <div className="summary">
              <div className="row"><span>Método</span><span>{order.metodo === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo'}</span></div>
              <div className="row"><span>Entrega</span><span>{form.tipoEntrega === 'retiro' ? 'Retiro en local' : 'Envío a domicilio'}</span></div>
              <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
            </div>
            {order.metodo === 'transferencia' && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Envíanos el comprobante por WhatsApp para confirmar tu pedido.</p>
            )}
            {order.metodo === 'efectivo' && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Pagás en efectivo al recibir o retirar tu pedido.</p>
            )}
            <a className="btn-primary" href={`https://wa.me/5491127650658?text=${encodeURIComponent(`Hola! Pedido ${order.code}`)}`} target="_blank" rel="noreferrer">Coordinar por WhatsApp →</a>
          </div>
        ) : (
          <>
            <h3 className="modal-title">Finalizar compra</h3>
            <div className="checkout-summary">
              {detailed.map(p => {
                const key = p.sku || p.id
                const name = p.nombre || p.name
                const price = p.precio ?? p.price ?? 0
                return (
                  <div key={key} className="mini-item">
                    <span className="mini-thumb" style={{ width: 28, height: 28, borderRadius: 6, overflow: 'hidden', background: '#f5f5f7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {p.emoji ? p.emoji : p.imagen ? <img src={p.imagen} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }} /> : '○'}
                    </span>
                    <span className="mini-name">{name} × {p.qty}</span>
                    <b>{ars(price * p.qty)}</b>
                  </div>
                )
              })}
              <div className="row"><span>{form.tipoEntrega === 'retiro' ? 'Retiro' : 'Envío'}</span><span className={shipping === 0 || form.tipoEntrega === 'retiro' ? 'free' : ''}>{form.tipoEntrega === 'retiro' ? 'Gratis' : shipping === 0 ? 'Gratis' : ars(shipping)}</span></div>
              <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
            </div>
            <form onSubmit={submit} className="checkout-form">
              <div className="field span2"><label htmlFor="f-nombre">Nombre completo *</label><input id="f-nombre" required minLength={3} value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Juan Pérez" /></div>
              <div className="field span2"><label htmlFor="f-email">Email *</label><input id="f-email" type="email" required value={form.email} onChange={e => setF('email', e.target.value)} placeholder="juan@email.com" /></div>
              <div className="field"><label htmlFor="f-tel">WhatsApp *</label><input id="f-tel" type="tel" required value={form.telefono} onChange={e => setF('telefono', e.target.value)} placeholder="+54 9 11 5555-5555" /></div>
              <div className="field span2">
                <label style={{ display: 'block', marginBottom: 6 }}>Tipo de entrega *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1px solid ${form.tipoEntrega === 'envio' ? 'var(--accent)' : '#ddd'}`, background: form.tipoEntrega === 'envio' ? '#f0f7ff' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="radio" name="entrega" checked={form.tipoEntrega === 'envio'} onChange={() => setF('tipoEntrega', 'envio')} style={{ accentColor: 'var(--accent)' }} />
                    🚚 Envío a domicilio
                  </label>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1px solid ${form.tipoEntrega === 'retiro' ? 'var(--accent)' : '#ddd'}`, background: form.tipoEntrega === 'retiro' ? '#f0f7ff' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="radio" name="entrega" checked={form.tipoEntrega === 'retiro'} onChange={() => setF('tipoEntrega', 'retiro')} style={{ accentColor: 'var(--accent)' }} />
                    🏬 Retiro en el local
                  </label>
                </div>
              </div>
              {form.tipoEntrega === 'envio' ? (
                <>
                  <div className="field"><label htmlFor="f-ciudad">Ciudad *</label><input id="f-ciudad" required value={form.ciudad} onChange={e => setF('ciudad', e.target.value)} placeholder="Buenos Aires" /></div>
                  <div className="field span2"><label htmlFor="f-dir">Dirección *</label><input id="f-dir" required minLength={5} value={form.direccion} onChange={e => setF('direccion', e.target.value)} placeholder="Av. Santa Fe 2844, Piso 3" /></div>
                </>
              ) : (
                <div className="field span2" style={{ padding: '12px 14px', borderRadius: 10, background: '#f0f7ff', border: '1px solid #b3d9ff' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6, display: 'block' }}>Retirá gratis en nuestro local</label>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
                    <b>Dirección:</b> Av. Santa Fe 2844, Piso 3, CABA<br />
                    <b>Horario:</b> Lunes a Viernes 10 a 18hs
                  </p>
                </div>
              )}
              <div className="pay-methods span2">
                <label className={form.pago === 'transferencia' ? 'checked' : ''}><input type="radio" name="pago" checked={form.pago === 'transferencia'} onChange={() => setF('pago', 'transferencia')} /> Transferencia bancaria</label>
                <label className={form.pago === 'efectivo' ? 'checked' : ''}><input type="radio" name="pago" checked={form.pago === 'efectivo'} onChange={() => setF('pago', 'efectivo')} /> Efectivo</label>
              </div>
              {form.pago === 'efectivo' && (
                <div className="field span2" style={{ padding: '12px 14px', borderRadius: 10, background: '#f0faf0', border: '1px solid #bfe3bf' }}>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>Pagás en <b>efectivo</b> al recibir tu pedido o al retirarlo en el local.</p>
                </div>
              )}
              {form.pago === 'transferencia' && (
                <div className="field span2" style={{ padding: '12px 14px', borderRadius: 10, background: '#f0f7ff', border: '1px solid #b3d9ff' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6, display: 'block' }}>Datos para transferencia</label>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
                    <b>CBU:</b> 0000003100000000000000<br />
                    <b>Alias:</b> TECNOSTORE.PAGOS<br />
                    <b>Titular:</b> TechnoStore S.R.L.<br />
                    <b>Banco:</b> Mercado Pago
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Subir comprobante (opcional)</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setComprobante(e.target.files?.[0] || null)} style={{ fontSize: 12 }} />
                    {comprobante && <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>✓ {comprobante.name}</span>}
                  </div>
                </div>
              )}
              <button type="submit" className="btn-primary checkout span2" disabled={sending}>{sending ? 'Procesando…' : `Confirmar pedido · ${ars(total)}`}</button>
              {error && <p className="secure span2" style={{ color: '#d70015', fontWeight: 600 }}>⚠ {error}</p>}
              <p className="secure span2">Compra protegida</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
