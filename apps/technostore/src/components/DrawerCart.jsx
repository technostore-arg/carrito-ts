import { useEffect, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'
import ProductMedia from './ProductMedia.jsx'
import FreeShippingProgress from './FreeShippingProgress.jsx'

/**
 * Drawer del carrito: lateral en desktop, pantalla completa en mobile.
 * @param {{open:boolean, onClose:()=>void, onCheckout:()=>void}} props
 */
export default function DrawerCart({ open, onClose, onCheckout }) {
  const {
    items, count, subtotal, descuento, shipping, total, metodoPago,
    updateQty, removeFromCart, cupon, couponError, applyCoupon, removeCoupon, getPrice,
  } = useCart()
  const [code, setCode] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const submitCoupon = e => {
    e.preventDefault()
    if (applyCoupon(code)) setCode('')
  }

  return (
    <div className="drawer-layer" role="presentation">
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Tu carrito">
        <header className="drawer-head">
          <div>
            <h2>Tu carrito <em>({count})</em></h2>
            <p className="muted">Precios finales · {metodoPago === 'tarjeta' ? 'tarjeta' : metodoPago === 'efectivo' ? 'efectivo' : 'transferencia'}</p>
          </div>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Cerrar carrito">✕</button>
        </header>

        {items.length === 0 ? (
          <div className="drawer-empty">
            <span aria-hidden>◇</span>
            <h3>Tu carrito está vacío</h3>
            <p className="muted">Sumá productos para ver el total y el envío gratis.</p>
            <button className="btn-primary" onClick={onClose}>Seguir comprando</button>
          </div>
        ) : (
          <>
            <div className="drawer-body">
              <FreeShippingProgress />
              <ul className="drawer-items">
                {items.map(item => (
                  <li key={item.sku} className="drawer-item">
                    <ProductMedia src={item.imagen} alt={item.nombre} className="drawer-item__media" />
                    <div className="drawer-item__info">
                      <h3>{item.nombre}</h3>
                      <span className="brand">{item.sku}</span>
                      <strong>{ars(getPrice(item) * item.qty)}</strong>
                      <div className="drawer-item__controls">
                        <div className="cart-qty">
                          <button onClick={() => updateQty(item.sku, -1)} aria-label={`Restar ${item.nombre}`} disabled={item.qty <= 1}>−</button>
                          <span>{item.qty}</span>
                          <button onClick={() => updateQty(item.sku, +1)} aria-label={`Sumar ${item.nombre}`} disabled={item.stock > 0 && item.qty >= item.stock}>+</button>
                        </div>
                        <button className="cart-remove" onClick={() => removeFromCart(item.sku)}>Eliminar</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <form className="coupon-form" onSubmit={submitCoupon}>
                <label htmlFor="cupon">¿Tenés un cupón?</label>
                <div className="coupon-row">
                  <input id="cupon" value={code} onChange={e => setCode(e.target.value)} placeholder="Ej. BIENVENIDA10" autoComplete="off" />
                  <button type="submit" className="btn-ghost">Aplicar</button>
                </div>
                {cupon && (
                  <div className="coupon-applied">
                    <span>✓ {cupon.code} · {cupon.etiqueta}</span>
                    <button type="button" onClick={removeCoupon} aria-label="Quitar cupón">✕</button>
                  </div>
                )}
                {couponError && <p className="field-error" role="alert">{couponError}</p>}
              </form>
            </div>

            <footer className="drawer-foot">
              <div className="row"><span>Subtotal</span><span>{ars(subtotal)}</span></div>
              {descuento > 0 && <div className="row row--discount"><span>Descuento</span><span>−{ars(descuento)}</span></div>}
              <div className="row"><span>Envío</span><span className={shipping === 0 ? 'free' : ''}>{shipping === 0 ? 'Gratis' : ars(shipping)}</span></div>
              <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
              <button className="btn-primary drawer-checkout" onClick={onCheckout}>Finalizar compra · {ars(total)}</button>
              <p className="drawer-secure">Compra protegida · Factura A/B · Sin registro</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
