import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { ars } from '../utils/format'

export default function CheckoutModal({ onClose }) {
  const { detailed, shipping, total, clearCart } = useCart()
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', direccion: '', ciudad: 'CABA', pago: 'mercadopago', card: '', exp: '', cvv: '', tipoEntrega: 'envio' })
  const [order, setOrder] = useState(null)
  const [redirecting, setRedirecting] = useState(null)
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
      const res = await fetch('/api/checkout/crear-preferencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al crear preferencia')
      if (form.pago === 'mercadopago') {
        if (data.init_point) { setRedirecting({ url: data.init_point, code: data.code }); clearCart(); setTimeout(() => { window.location.href = data.init_point }, 1600); return }
        setError('No se obtuvo URL de pago')
      } else {
        const orderRes = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const orderData = await orderRes.json().catch(() => ({}))
        if (!orderRes.ok) throw new Error(orderData.error || 'Error al crear pedido')
        setOrder({ code: orderData.code }); clearCart()
      }
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : err.message)
    } finally { setSending(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Cerrar">✕</button>
        {redirecting ? (
          <div className="success">
            <span className="success-icon">○</span>
            <h3>Te llevamos a MercadoPago…</h3>
            <p>Tu pedido quedó registrado. En segundos vas a poder completar el pago.</p>
            <div className="order-code">Pedido: <code>{redirecting.code}</code></div>
          </div>
        ) : order ? (
          <div className="success">
            <span className="success-icon">✓</span>
            <h3>¡Pedido registrado!</h3>
            <p>Gracias <b>{form.nombre}</b>. Confirmación a <b>{form.email}</b>.</p>
            <div className="order-code">Orden: <code>{order.code}</code></div>
            <div className="summary">
              <div className="row"><span>Método</span><span>{form.pago === 'mercadopago' ? 'MercadoPago' : form.pago === 'transferencia' ? 'Transferencia' : 'Tarjeta'}</span></div>
              <div className="row"><span>Entrega</span><span>{form.tipoEntrega === 'retiro' ? 'Retiro en local' : 'Envío a domicilio'}</span></div>
              <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
            </div>
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
                <label className={form.pago === 'mercadopago' ? 'checked' : ''}><input type="radio" name="pago" checked={form.pago === 'mercadopago'} onChange={() => setF('pago', 'mercadopago')} /> MercadoPago · cuotas</label>
                <label className={form.pago === 'transferencia' ? 'checked' : ''}><input type="radio" name="pago" checked={form.pago === 'transferencia'} onChange={() => setF('pago', 'transferencia')} /> Transferencia · -10%</label>
                <label className={form.pago === 'tarjeta' ? 'checked' : ''}><input type="radio" name="pago" checked={form.pago === 'tarjeta'} onChange={() => setF('pago', 'tarjeta')} /> Tarjeta</label>
              </div>
              {form.pago === 'tarjeta' && (
                <>
                  <div className="field span2"><label htmlFor="f-card">Número de tarjeta *</label><input id="f-card" required inputMode="numeric" minLength={19} value={form.card} onChange={e => setF('card', e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())} placeholder="4242 4242 4242 4242" /></div>
                  <div className="field"><label htmlFor="f-exp">Vencimiento (MM/AA) *</label><input id="f-exp" required pattern="(0[1-9]|1[0-2])\/\d{2}" value={form.exp} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 4); setF('exp', d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d) }} placeholder="12/28" /></div>
                  <div className="field"><label htmlFor="f-cvv">CVV *</label><input id="f-cvv" required inputMode="numeric" maxLength={4} pattern="\d{3,4}" value={form.cvv} onChange={e => setF('cvv', e.target.value.replace(/\D/g, ''))} placeholder="123" /></div>
                </>
              )}
              <button type="submit" className="btn-primary checkout span2" disabled={sending}>{sending ? 'Procesando…' : form.pago === 'mercadopago' ? `Pagar · ${ars(total)}` : `Confirmar · ${ars(total)}`}</button>
              {error && <p className="secure span2" style={{ color: '#d70015', fontWeight: 600 }}>⚠ {error}</p>}
              <p className="secure span2">Compra protegida</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
