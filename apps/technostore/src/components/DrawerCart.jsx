/** Mini-carrito lateral: items con precio recalculado, cupones, resumen con el total. */
import { useEffect, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'
import ProductMedia from './ProductMedia.jsx'
import FreeShippingProgress from './FreeShippingProgress.jsx'
import { Button } from './Button.jsx'
import { FormField } from './FormField.jsx'
import { Badge } from './Badge.jsx'

export default function DrawerCart({ open, onClose, onCheckout }) {
  const { items, count, subtotal, descuento, shipping, total, metodoPago, updateQty, removeFromCart, cupon, couponError, applyCoupon, removeCoupon, getPrice } = useCart()
  const [code, setCode] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null

  const submitCoupon = e => { e.preventDefault(); if (applyCoupon(code)) setCode('') }

  return (
    <div className="ts-drawer-layer">
      <div className="ts-drawer-overlay" onClick={onClose} />
      <aside className="ts-drawer" role="dialog" aria-modal="true" aria-label="Tu carrito">
        <header className="ts-drawer-head">
          <div>
            <h2>Tu carrito <em>({count})</em></h2>
            <p className="ts-muted">Precios recalculados en el servidor.</p>
          </div>
          <button ref={closeRef} className="ts-drawer-close" onClick={onClose} aria-label="Cerrar carrito">✕</button>
        </header>

        {items.length === 0 ? (
          <div className="ts-drawer-empty">
            <span aria-hidden className="ts-drawer-empty-icon">◇</span>
            <h3>Tu carrito está vacío</h3>
            <p className="ts-muted">Sumá productos para ver el total y el envío gratis.</p>
            <Button variant="primary" onClick={onClose}>Seguir comprando</Button>
          </div>
        ) : (
          <>
            <div className="ts-drawer-body">
              <FreeShippingProgress />
              <ul className="ts-drawer-items">
                {items.map(item => (
                  <li key={item.sku} className="ts-drawer-item">
                    <ProductMedia src={item.imagen} alt={item.nombre} className="ts-drawer-item__media" />
                    <div className="ts-drawer-item__info">
                      <h3>{item.nombre}</h3>
                      <span className="ts-drawer-item__sku">{item.sku}</span>
                      <strong className="ts-drawer-item__price">{ars(getPrice(item) * item.qty)}</strong>
                      <div className="ts-drawer-item__controls">
                        <div className="ts-cart-qty" role="group" aria-label={`Cantidad de ${item.nombre}`}>
                          <Button variant="secondary" size="sm" aria-label={`Restar ${item.nombre}`} disabled={item.qty <= 1} onClick={() => updateQty(item.sku, -1)}>−</Button>
                          <span className="ts-cart-qty__n">{item.qty}</span>
                          <Button variant="secondary" size="sm" aria-label={`Sumar ${item.nombre}`} onClick={() => updateQty(item.sku, +1)}>+</Button>
                        </div>
                        <Button variant="ghost" size="sm" className="ts-drawer-remove" onClick={() => removeFromCart(item.sku)}>Eliminar</Button>
                      </div>
                    </div>
                    {item.qty > 1 && <Badge variant="high">x{item.qty}</Badge>}
                  </li>
                ))}
              </ul>
            </div>

            <form className="ts-coupon" onSubmit={submitCoupon}>
              <FormField label="Cupón (opcional)" hint="Un código válido aplica el descuento real" id="ts-coupon">
                <div className="ts-coupon__row">
                  <input id="ts-coupon" className="ts-coupon__input" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej. BIENVENIDA10" autoComplete="off" />
                  <Button variant="secondary" size="sm" type="submit">Aplicar</Button>
                </div>
              </FormField>
              {cupon && <p className="ts-coupon-applied">✓ {cupon.code} · {cupon.etiqueta}</p>}
              {couponError && <p className="ts-field-error">{couponError}</p>}
            </form>

            <footer className="ts-drawer-foot">
              <div className="ts-drawer-summary">
                <div className="ts-drawer-summary__row"><span>Subtotal</span><span>{ars(subtotal)}</span></div>
                {descuento > 0 && <div className="ts-drawer-summary__row ts-drawer-summary__row--discount"><span>Descuento</span><span>−{ars(descuento)}</span></div>}
                <div className="ts-drawer-summary__row"><span>Envío</span><span className={shipping === 0 ? 'is-free' : ''}>{shipping === 0 ? 'Gratis' : ars(shipping)}</span></div>
                <div className="ts-drawer-summary__row ts-drawer-summary__row--total"><span>Total</span><b>{ars(total)}</b></div>
                {metodoPago && <div className="ts-drawer-summary__row ts-drawer-summary__row--meta"><span>Pago</span><span>{metodoPago}</span></div>}
              </div>
              <Button variant="primary" onClick={onCheckout}>Finalizar compra · {ars(total)}</Button>
              <p className="ts-drawer-secure">Compra protegida · Facturación A/B · Sin registro</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
