import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { ars } from '../utils/format'

export default function CheckoutModal({ onClose }) {
  const { detailed, subtotal, shipping, total, clearCart } = useCart()
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: 'CABA',
    pago: 'mercadopago',
    card: '',
    exp: '',
    cvv: '',
  })
  const [order, setOrder] = useState(null)
  const [redirecting, setRedirecting] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const submit = async e => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch('/api/checkout/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: form.nombre,
            email: form.email,
            phone: form.telefono,
            city: form.ciudad,
            address: form.direccion,
            paymentMethod: form.pago,
          },
          items: detailed.map(p => ({ id: p.id, qty: p.qty })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al crear preferencia de pago')

      if (form.pago === 'mercadopago') {
        if (data.init_point) {
          setRedirecting({ url: data.init_point, code: data.code })
          clearCart()
          setTimeout(() => {
            window.location.href = data.init_point
          }, 1600)
          return
        }
        // Fallback if no init_point (should not happen)
        setError('No se obtuvo URL de pago de MercadoPago')
      } else {
        // For other payment methods, we still create an order via the legacy endpoint (simulated)
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: {
              name: form.nombre,
              email: form.email,
              phone: form.telefono,
              city: form.ciudad,
              address: form.direccion,
              paymentMethod: form.pago,
            },
            items: detailed.map(p => ({ id: p.id, qty: p.qty })),
          }),
        })
        const orderData = await orderRes.json().catch(() => ({}))
        if (!orderRes.ok) throw new Error(orderData.error || 'Error al crear pedido')
        setOrder({ code: orderData.code })
        clearCart()
      }
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'No hay conexión con el servidor. ¿Está corriendo `npm run dev`?'
          : err.message,
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>

        {redirecting ? (
          <div className="success">
            <span className="success-icon">💙</span>
            <h3>Te llevamos a MercadoPago…</h3>
            <p>Tu pedido quedó registrado. En unos segundos vas a poder completar el pago.</p>
            <div className="order-code">
              Pedido: <code>{redirecting.code}</code>
            </div>
          </div>
        ) : order ? (
          <div className="success">
            <span className="success-icon">✅</span>
            <h3>¡Pedido registrado!</h3>
            <p>
              Gracias <b>{form.nombre}</b>. Enviamos la confirmación a{' '}
              <b>{form.email}</b>.
            </p>
            <div className="order-code">
              Orden: <code>{order.code}</code>
            </div>
            <div className="summary">
              <div className="row">
                <span>Método de pago</span>
                <span>
                  {form.pago === 'mercadopago' ? '💙 MercadoPago' : form.pago === 'transferencia' ? '🏦 Transferencia' : '💳 Tarjeta'}
                </span>
              </div>
              <div className="row total">
                <span>Total</span>
                <b>{ars(total)}</b>
              </div>
            </div>
            <a
              className="btn-primary"
              href={`https://wa.me/5491127650658?text=${encodeURIComponent(`Hola! Acabo de hacer el pedido ${order.code}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Coordinar por WhatsApp →
            </a>
          </div>
        ) : (
          <>
            <h3 className="modal-title">Finalizar compra</h3>

            <div className="checkout-summary">
              {detailed.map(p => (
                <div key={p.id} className="mini-item">
                  <span className="mini-thumb">{p.emoji}</span>
                  <span className="mini-name">{p.name} × {p.qty}</span>
                  <b>{ars(p.price * p.qty)}</b>
                </div>
              ))}
              <div className="row">
                <span>Envío</span>
                <span className={shipping === 0 ? 'free' : ''}>
                  {shipping === 0 ? 'Gratis' : ars(shipping)}
                </span>
              </div>
              <div className="row total">
                <span>Total</span>
                <b>{ars(total)}</b>
              </div>
            </div>

            <form onSubmit={submit} className="checkout-form">
              <div className="field span2">
                <label htmlFor="f-nombre">Nombre completo *</label>
                <input
                  id="f-nombre"
                  required
                  minLength={3}
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  placeholder="Juan Pérez"
                />
              </div>
              <div className="field span2">
                <label htmlFor="f-email">Email *</label>
                <input
                  id="f-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="juan@email.com"
                />
              </div>
              <div className="field">
                <label htmlFor="f-tel">WhatsApp / Teléfono *</label>
                <input
                  id="f-tel"
                  type="tel"
                  required
                  value={form.telefono}
                  onChange={e => set('telefono', e.target.value)}
                  placeholder="+54 9 11 5555-5555"
                />
              </div>
              <div className="field">
                <label htmlFor="f-ciudad">Provincia / Ciudad *</label>
                <input
                  id="f-ciudad"
                  required
                  value={form.ciudad}
                  onChange={e => set('ciudad', e.target.value)}
                  placeholder="Buenos Aires"
                />
              </div>
              <div className="field span2">
                <label htmlFor="f-dir">Dirección de envío *</label>
                <input
                  id="f-dir"
                  required
                  minLength={5}
                  value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  placeholder="Av. Santa Fe 2844, Piso 3"
                />
              </div>

              <div className="pay-methods span2">
                <label className={form.pago === 'mercadopago' ? 'checked' : ''}>
                  <input
                    type="radio"
                    name="pago"
                    checked={form.pago === 'mercadopago'}
                    onChange={() => set('pago', 'mercadopago')}
                  />
                  💙 MercadoPago · cuotas
                </label>
                <label className={form.pago === 'transferencia' ? 'checked' : ''}>
                  <input
                    type="radio"
                    name="pago"
                    checked={form.pago === 'transferencia'}
                    onChange={() => set('pago', 'transferencia')}
                  />
                  🏦 Transferencia · -10%
                </label>
                <label className={form.pago === 'tarjeta' ? 'checked' : ''}>
                  <input
                    type="radio"
                    name="pago"
                    checked={form.pago === 'tarjeta'}
                    onChange={() => set('pago', 'tarjeta')}
                  />
                  💳 Tarjeta
                </label>
              </div>

              {form.pago === 'tarjeta' && (
                <>
                  <div className="field span2">
                    <label htmlFor="f-card">Número de tarjeta *</label>
                    <input
                      id="f-card"
                      required
                      inputMode="numeric"
                      minLength={19}
                      value={form.card}
                      onChange={e =>
                        set(
                          'card',
                          e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 16)
                            .replace(/(.{4})/g, '$1 ')
                            .trim(),
                        )
                      }
                      placeholder="4242 4242 4242 4242"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="f-exp">Vencimiento (MM/AA) *</label>
                    <input
                      id="f-exp"
                      required
                      pattern="(0[1-9]|1[0-2])\/\d{2}"
                      title="Formato MM/AA"
                      value={form.exp}
                      onChange={e => {
                        const d = e.target.value.replace(/\D/g, '').slice(0, 4)
                        set('exp', d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
                      }}
                      placeholder="12/28"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="f-cvv">CVV *</label>
                    <input
                      id="f-cvv"
                      required
                      inputMode="numeric"
                      maxLength={4}
                      pattern="\d{3,4}"
                      title="3 o 4 dígitos"
                      value={form.cvv}
                      onChange={e => set('cvv', e.target.value.replace(/\D/g, ''))}
                      placeholder="123"
                    />
                  </div>
                </>
              )}

              <button type="submit" className="btn-primary checkout span2" disabled={sending}>
                {sending
                  ? 'Procesando…'
                  : form.pago === 'mercadopago'
                    ? `Pagar con MercadoPago · ${ars(total)}`
                    : `Confirmar pedido · ${ars(total)}`}
              </button>
              {error && (
                <p className="secure span2" style={{ color: '#fb7185', fontWeight: 600 }}>
                  ⚠️ {error}
                </p>
              )}
              <p className="secure span2">🔒 Compra protegida · Factura A/B según corresponda</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
