/** Checkout premium (TechnoStore): datos del cliente con FormField, entrega sin direcciones, resumen integrado. */
import { useMemo, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'
import { Button } from './Button.jsx'
import { FormField } from './FormField.jsx'

const PAYMENTS = [
  { id: 'transferencia', label: 'Transferencia', hint: 'Menor precio' },
  { id: 'efectivo', label: 'Efectivo', hint: 'Al recibir' },
  { id: 'tarjeta', label: 'Tarjeta', hint: 'Sin cuotas reales aún' },
]

function estime(cp, subtotalFinal) {
  const n = Number(cp)
  const zones = [
    [1000, 1999, 'CABA'], [2000, 2999, 'Gran Buenos Aires'], [3000, 3999, 'Bs. As. interior'],
    [4000, 5999, 'Centro del país'], [6000, 8999, 'Interior'], [9000, 9999, 'Patagonia'],
  ]
  if (subtotalFinal >= 300000) return 0
  if (!/^\d{4}$/.test(String(cp || ''))) return 0
  const z = zones.find(([from, to]) => n >= from && n <= to)
  return z ? Number(z[2].replace(/\D/g, '').slice(-2)) * 0 : 0
}

export default function Checkout({ onClose }) {
  const { items, subtotal, descuento, shipping, total, metodoPago, setMetodoPago, entrega, setEntrega, getPrice } = useCart()
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', cp: entrega?.cp || '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [order, setOrder] = useState(null)
  const [errorState, setErrorState] = useState(null)

  const tipoEntrega = String(entrega?.tipo || 'envio')
  const errores = useMemo(() => {
    const e = {}
    if (submitted) {
      if (!String(form.nombre || '').trim()) e.nombre = 'Ingresá tu nombre completo'
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(form.email || '').trim())) e.email = 'Ingresá un email válido'
      if (!String(form.telefono || '').trim()) e.telefono = 'Ingresá tu WhatsApp'
    }
    return e
  }, [form, submitted])
  const valido = !Object.values(errores).some(Boolean)

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const submit = async e => {
    e.preventDefault()
    setSubmitted(true)
    if (!valido || sending) return
    setSending(true); setErrorState(null)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: form.nombre.trim(), email: form.email.trim(), phone: form.telefono, cp: form.cp || '', tipoEntrega },
          items,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pedido')
      setOrder({ code: data.code, total })
    } catch (err) {
      setErrorState(err.message === 'Failed to fetch' ? 'No hay conexión con el servidor.' : err.message)
    } finally { setSending(false) }
  }

  return (
    <div className="ts-checkout-layer">
      <div className="ts-checkout-overlay" onClick={() => !sending && onClose()} />
      <div className="ts-checkout">
        {order ? (
          <div className="ts-checkout-success">
            <span aria-hidden className="ts-checkout-success__icon">✓</span>
            <h2>Pedido confirmado</h2>
            <p><b>{form.nombre}</b>, gracias — te escribimos al WhatsApp para coordinar.</p>
            <div className="ts-checkout-summary">
              <div className="ts-checkout-summary__row"><span>Entrega</span><span>{tipoEntrega === 'retiro' ? 'Retiro en Barrio Norte (coordinación previa)' : `Envío a CP ${form.cp || 'sin definir'}`}</span></div>
              <div className="ts-checkout-summary__row"><span>Pago</span><span>{metodoPago}</span></div>
              <div className="ts-checkout-summary__row ts-checkout-summary__row--total"><span>Total</span><b>{ars(order.total)}</b></div>
            </div>
            <Button variant="primary" onClick={onClose}>Volver a la tienda</Button>
          </div>
        ) : (
          <>
            <form className="ts-checkout-form" onSubmit={submit} noValidate>
              <div className="ts-checkout-section">
                <h3 className="ts-checkout-section-title">Datos del cliente</h3>
                <FormField label="Nombre y apellido" id="ts-c-nombre" required error={errores.nombre}>
                  <input id="ts-c-nombre" className="ts-field-input" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan Pérez" autoComplete="name" />
                </FormField>
                <FormField label="Email" id="ts-c-email" required error={errores.email}>
                  <input id="ts-c-email" type="email" className="ts-field-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@email.com" autoComplete="email" />
                </FormField>
                <FormField label="WhatsApp" id="ts-c-tel" required error={errores.telefono}>
                  <input id="ts-c-tel" className="ts-field-input" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 9 11 5555-5555" autoComplete="tel" />
                </FormField>
              </div>

              <div className="ts-checkout-section">
                <h3 className="ts-checkout-section-title">Entrega</h3>
                <div className="ts-delivery">
                  <button type="button" className={['ts-delivery__opt', tipoEntrega === 'envio' ? 'is-active' : ''].join(' ')} onClick={() => setEntrega({ tipo: 'envio', cp: form.cp })} aria-pressed={tipoEntrega === 'envio'}>
                    <span className="ts-delivery__title">Envío a domicilio</span>
                    <span className="ts-delivery__sub">Estimado para el CP: ${ars(estime(form.cp, subtotal - descuento))}</span>
                  </button>
                  <button type="button" className={['ts-delivery__opt', tipoEntrega === 'retiro' ? 'is-active' : ''].join(' ')} onClick={() => setEntrega({ tipo: 'retiro', cp: '' })} aria-pressed={tipoEntrega === 'retiro'}>
                    <span className="ts-delivery__title">Retiro en Barrio Norte</span>
                    <span className="ts-delivery__sub">(Coordinación previa — la dirección se informa tras confirmar el pago)</span>
                  </button>
                </div>
                {tipoEntrega === 'envio' && (
                  <FormField label="Código postal (para el envío)" id="ts-c-cp" hint="El envío estimado depende del CP">
                    <input id="ts-c-cp" className="ts-field-input" value={form.cp} onChange={e => set('cp', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="1424" />
                  </FormField>
                )}
                {tipoEntrega === 'retiro' && (
                  <p className="ts-checkout-note">Sin dirección hasta confirmar el pago.</p>
                )}
              </div>

              <div className="ts-checkout-section">
                <h3 className="ts-checkout-section-title">Forma de pago</h3>
                <div className="ts-pay-methods" role="radiogroup" aria-label="Forma de pago">
                  {PAYMENTS.map(m => (
                    <button type="button" key={m.id} className={['ts-pay-method', metodoPago === m.id ? 'is-active' : ''].join(' ')} onClick={() => setMetodoPago(m.id)} role="radio" aria-checked={metodoPago === m.id}>
                      <span className="ts-pay-method__label">{m.label}</span>
                      <span className="ts-pay-method__hint">{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>

            <div className="ts-checkout-summary">
              <h3 className="ts-checkout-summary__title">Resumen</h3>
              <ul className="ts-checkout-summary__items">
                {items.map(p => (
                  <li key={p.sku}><span className="ts-checkout-summary__name">{p.nombre}</span><span className="ts-checkout-summary__price">{ars(getPrice(p) * p.qty)}</span></li>
                ))}
              </ul>
              <div className="ts-checkout-summary__row"><span>Subtotal</span><span>{ars(subtotal)}</span></div>
              {descuento > 0 && <div className="ts-checkout-summary__row ts-checkout-summary__row--discount"><span>Descuento</span><span>−{ars(descuento)}</span></div>}
              <div className="ts-checkout-summary__row"><span>Envío</span><span className={shipping === 0 ? 'is-free' : ''}>{shipping === 0 ? 'Gratis' : ars(shipping)}</span></div>
              <div className="ts-checkout-summary__row ts-checkout-summary__row--total"><span>Total</span><b>{ars(total)}</b></div>
              <Button variant="primary" className="ts-checkout-submit" onClick={submit} disabled={sending || !valido}>Confirmar pedido · {ars(total)}</Button>
              <p className="ts-checkout-secure">Compra protegida · Facturación A/B · Sin registro</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
