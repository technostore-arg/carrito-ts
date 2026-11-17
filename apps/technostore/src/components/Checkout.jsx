/**
 * Checkout one-page, sin registro. Validación en tiempo real,
 * entrega por CP y tres métodos de pago.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'
import { shippingZone, INSTALLMENTS } from '../config/store.js'
import { validarCheckout } from '../utils/validation.js'
import { installment } from '../utils/pricing.js'
import ProductMedia from './ProductMedia.jsx'
import FreeShippingProgress from './FreeShippingProgress.jsx'

const PAGOS = [
  { id: 'transferencia', label: 'Transferencia', detalle: 'Menor precio' },
  { id: 'efectivo', label: 'Efectivo', detalle: 'Al recibir o retirar' },
  { id: 'tarjeta', label: 'Tarjeta', detalle: 'Hasta 12 cuotas' },
]

/** @param {{onClose:()=>void}} props */
export default function Checkout({ onClose }) {
  const {
    items, subtotal, descuento, shipping, total, metodoPago, setMetodoPago,
    entrega, setEntrega, cupon, clearCart, getPrice,
  } = useCart()
  const [form, setForm] = useState(() => ({
    nombre: '', email: '', telefono: '', cp: entrega?.cp || '',
    direccion: '', piso: '', tipoEntrega: entrega?.tipo || 'envio',
    factura: false, tipoDocumento: 'DNI', documento: '',
  }))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  const [cuotas, setCuotas] = useState(INSTALLMENTS[0])
  const [comprobante, setComprobante] = useState(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape' && !sending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose, sending])

  // El carrito usa esta misma entrega para calcular el envío en vivo.
  useEffect(() => { setEntrega({ tipo: form.tipoEntrega, cp: form.cp }) }, [form.tipoEntrega, form.cp]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const blur = field => setTouched(prev => ({ ...prev, [field]: true }))

  const errores = useMemo(() => {
    const e = validarCheckout(form)
    if (form.tipoEntrega === 'retiro') { e.cp = null; e.direccion = null }
    if (!form.factura || !form.documento) e.documento = null
    return e
  }, [form])
  const primerError = Object.values(errores).find(Boolean)
  const showError = field => (touched[field] || submitted) ? errores[field] : null
  const valido = !primerError

  const zona = shippingZone(form.cp)
  const envioFinal = form.tipoEntrega === 'retiro' ? 0 : shipping

  const submit = async e => {
    e.preventDefault()
    setSubmitted(true)
    if (!valido || sending) return
    setError(null); setSending(true)
    try {
      const payload = {
        customer: {
          name: form.nombre.trim(), email: form.email.trim(), phone: form.telefono,
          cp: form.cp, city: zona?.label || form.cp || '', address: form.direccion,
          tipoEntrega: form.tipoEntrega, paymentMethod: metodoPago,
          documento: form.factura ? `${form.tipoDocumento} ${form.documento}` : null,
          cuotas: metodoPago === 'tarjeta' ? cuotas : null,
        },
        items: items.map(p => ({ id: p.sku, nombre: p.nombre, qty: p.qty, precio: getPrice(p) })),
      }
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pedido')

      if (metodoPago === 'transferencia' && comprobante) {
        const base64 = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(comprobante)
        })
        if (base64) {
          await fetch('/api/comprobantes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderCode: data.code, customerName: form.nombre, comprobanteData: base64 }),
          }).catch(() => {})
        }
      }
      setOrder({ code: data.code, total })
      clearCart()
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : err.message)
    } finally { setSending(false) }
  }

  if (order) {
    return (
      <div className="checkout-layer" role="dialog" aria-modal="true" aria-label="Pedido confirmado">
        <div className="checkout-overlay" />
        <section className="checkout-panel checkout-panel--success">
          <div className="checkout-success">
            <span className="success-icon">✓</span>
            <h2>¡Pedido registrado!</h2>
            <p>Gracias <b>{form.nombre}</b>. Te escribimos al WhatsApp <b>{form.telefono}</b> y enviamos la confirmación a <b>{form.email}</b>.</p>
            <p className="order-code">Código de orden: <code>{order.code}</code></p>
            <div className="summary-card">
              <div className="row"><span>Entrega</span><span>{form.tipoEntrega === 'retiro' ? 'Retiro en local' : `Envío a ${zona?.label || 'domicilio'}`}</span></div>
              <div className="row"><span>Pago</span><span>{PAGOS.find(p => p.id === metodoPago)?.label}</span></div>
              <div className="row total"><span>Total</span><b>{ars(order.total)}</b></div>
            </div>
            <a className="btn-primary" href={`https://wa.me/5491127650658?text=${encodeURIComponent(`Hola! Pedido ${order.code}`)}`} target="_blank" rel="noreferrer">Coordinar por WhatsApp →</a>
            <button className="btn-ghost" onClick={onClose}>Volver a la tienda</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="checkout-layer" role="dialog" aria-modal="true" aria-label="Finalizar compra">
      <div className="checkout-overlay" onClick={() => !sending && onClose()} />
      <section className="checkout-panel">
        <header className="checkout-head">
          <div>
            <span className="eyebrow">Compra como invitado</span>
            <h2>Finalizar compra</h2>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Cerrar checkout">✕</button>
        </header>

        <form onSubmit={submit} noValidate className="checkout-grid">
          <div className="checkout-col">
            <h3 className="checkout-step">1 · Tus datos</h3>
            <div className="field"><label htmlFor="ck-nombre">Nombre y apellido *</label>
              <input id="ck-nombre" value={form.nombre} onChange={e => set('nombre', e.target.value)} onBlur={() => blur('nombre')} placeholder="Juan Pérez" autoComplete="name" />
              {showError('nombre') && <span className="field-error">{showError('nombre')}</span>}
            </div>
            <div className="field"><label htmlFor="ck-email">Email *</label>
              <input id="ck-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} onBlur={() => blur('email')} placeholder="juan@email.com" autoComplete="email" />
              {showError('email') && <span className="field-error">{showError('email')}</span>}
            </div>
            <div className="field"><label htmlFor="ck-tel">WhatsApp *</label>
              <input id="ck-tel" type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} onBlur={() => blur('telefono')} placeholder="+54 9 11 5555-5555" autoComplete="tel" />
              {showError('telefono') && <span className="field-error">{showError('telefono')}</span>}
            </div>

            <label className="check-inline">
              <input type="checkbox" checked={form.factura} onChange={e => set('factura', e.target.checked)} />
              Necesito factura con DNI/CUIT
            </label>
            {form.factura && (
              <div className="checkout-inline-fields">
                <div className="field"><label htmlFor="ck-doc-tipo">Tipo</label>
                  <select id="ck-doc-tipo" value={form.tipoDocumento} onChange={e => set('tipoDocumento', e.target.value)}>
                    <option>DNI</option><option>CUIT</option>
                  </select>
                </div>
                <div className="field"><label htmlFor="ck-doc">Número *</label>
                  <input id="ck-doc" value={form.documento} onChange={e => set('documento', e.target.value)} onBlur={() => blur('documento')} placeholder={form.tipoDocumento === 'DNI' ? '30123456' : '20301234567'} />
                  {showError('documento') && <span className="field-error">{showError('documento')}</span>}
                </div>
              </div>
            )}

            <h3 className="checkout-step">2 · Entrega</h3>
            <div className="delivery-options">
              <button type="button" className={`delivery-card ${form.tipoEntrega === 'retiro' ? 'active' : ''}`} onClick={() => set('tipoEntrega', 'retiro')}>
                <span className="delivery-card__icon">🏬</span>
                <span><b>Retiro en el local</b><small>Av. Santa Fe 2844, CABA · Lun a Vie 10–18hs</small></span>
                <strong className="free">Gratis</strong>
              </button>
              <button type="button" className={`delivery-card ${form.tipoEntrega === 'envio' ? 'active' : ''}`} onClick={() => set('tipoEntrega', 'envio')}>
                <span className="delivery-card__icon">🚚</span>
                <span><b>Envío a domicilio</b><small>{zona ? `${zona.label} · ${ars(zona.costo)}` : 'Ingresá tu CP para calcular'}</small></span>
                <strong>{envioFinal === 0 ? 'Gratis' : ars(envioFinal)}</strong>
              </button>
            </div>
            {form.tipoEntrega === 'envio' && (
              <>
                <div className="field"><label htmlFor="ck-cp">Código postal *</label>
                  <input id="ck-cp" inputMode="numeric" maxLength={4} value={form.cp} onChange={e => set('cp', e.target.value.replace(/\D/g, '').slice(0, 4))} onBlur={() => blur('cp')} placeholder="1424" />
                  {showError('cp') && <span className="field-error">{showError('cp')}</span>}
                  {zona && !showError('cp') && <span className="field-ok">✓ {zona.label}</span>}
                </div>
                <div className="field"><label htmlFor="ck-dir">Calle y número *</label>
                  <input id="ck-dir" value={form.direccion} onChange={e => set('direccion', e.target.value)} onBlur={() => blur('direccion')} placeholder="Av. Santa Fe 2844" autoComplete="street-address" />
                  {showError('direccion') && <span className="field-error">{showError('direccion')}</span>}
                </div>
                <div className="field"><label htmlFor="ck-piso">Piso / Depto (opcional)</label>
                  <input id="ck-piso" value={form.piso} onChange={e => set('piso', e.target.value)} placeholder="Piso 3, Depto B" />
                </div>
              </>
            )}

            <h3 className="checkout-step">3 · Método de pago</h3>
            <div className="pay-options">
              {PAGOS.map(p => (
                <button type="button" key={p.id} className={`pay-option ${metodoPago === p.id ? 'active' : ''}`} onClick={() => setMetodoPago(p.id)}>
                  <span className="pay-radio" aria-hidden />
                  <span><b>{p.label}</b><small>{p.detalle}</small></span>
                </button>
              ))}
            </div>
            {metodoPago === 'tarjeta' && (
              <div className="field"><label htmlFor="ck-cuotas">Cuotas</label>
                <select id="ck-cuotas" value={cuotas} onChange={e => setCuotas(Number(e.target.value))}>
                  {INSTALLMENTS.map(n => <option key={n} value={n}>{n} cuotas de {ars(installment(getPrice({ precio_lista: items[0]?.precio_lista, precio_mercadopago: items[0]?.precio_mercadopago, precio_transferencia: items[0]?.precio_transferencia }) || total, n))}</option>)}
                </select>
              </div>
            )}
            {metodoPago === 'transferencia' && (
              <div className="pay-note">
                <b>Datos para transferir</b><br />Alias <code>TECNOSTORE.PAGOS</code> · CBU <code>0000003100000000000000</code>
                <label className="upload-note">Subir comprobante (opcional)
                  <input type="file" accept="image/*,.pdf" onChange={e => setComprobante(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}
          </div>

          <aside className="checkout-col checkout-col--summary">
            <h3 className="checkout-step">Resumen</h3>
            <FreeShippingProgress compact />
            <ul className="checkout-items">
              {items.map(p => (
                <li key={p.sku}>
                  <ProductMedia src={p.imagen} alt={p.nombre} className="checkout-item__media" />
                  <span><b>{p.nombre}</b><small>{p.qty} × {ars(getPrice(p))}</small></span>
                  <strong>{ars(getPrice(p) * p.qty)}</strong>
                </li>
              ))}
            </ul>
            <div className="summary-card">
              <div className="row"><span>Subtotal</span><span>{ars(subtotal)}</span></div>
              {descuento > 0 && <div className="row row--discount"><span>Descuento {cupon ? `(${cupon.code})` : ''}</span><span>−{ars(descuento)}</span></div>}
              <div className="row"><span>Entrega</span><span className={envioFinal === 0 ? 'free' : ''}>{envioFinal === 0 ? 'Gratis' : ars(envioFinal)}</span></div>
              <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
            </div>
            <button type="submit" className="btn-primary checkout-submit" disabled={sending || items.length === 0}>
              {sending ? 'Procesando…' : `Confirmar pedido · ${ars(total)}`}
            </button>
            {submitted && primerError && <p className="field-error" role="alert">Revisá los campos marcados.</p>}
            {error && <p className="field-error" role="alert">⚠ {error}</p>}
            <p className="checkout-secure">Compra protegida · Sin registro · Factura A/B</p>
          </aside>
        </form>
      </section>
    </div>
  )
}
