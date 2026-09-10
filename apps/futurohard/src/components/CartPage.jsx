import { useState } from "react"
import { useCart, FREE_SHIPPING_THRESHOLD } from "../context/CartContext"
import { ars } from "../utils/format"
import CheckoutModal from "./CheckoutModal"

export default function CartPage({ onBack }) {
  const { detailed, count, subtotal, shipping, total, updateQty, removeFromCart } = useCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  if (detailed.length === 0) {
    return (
      <div className="cart-page container">
        <button className="cart-back" onClick={onBack}>← Seguir comprando</button>
        <div className="cart-empty-page">
          <span>○</span>
          <h2>Tu carrito está vacío</h2>
          <p>Cuando agregues hardware, va a aparecer acá.</p>
          <button className="btn-primary" onClick={onBack}>Explorar hardware</button>
        </div>
      </div>
    )
  }

  const remaining = FREE_SHIPPING_THRESHOLD - subtotal
  const hasFree = shipping === 0

  return (
    <div className="cart-page container">
      <div className="cart-page-header">
        <button className="cart-back" onClick={onBack}>← Seguir comprando</button>
          <h1>Carrito <em>({count} {count === 1 ? "producto" : "productos"})</em></h1>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {detailed.map(p => {
            const key = p.sku || p.id
            const name = p.nombre || p.name
            const price = p.precio ?? p.price
            const sku = p.sku || p.id
            const img = p.imagen || p.image || p.imagenes?.[0]
            const isEmoji = !p.sku && p.emoji
            return (
              <div key={key} className="cart-row">
                <div className="cart-row-thumb">
                  {isEmoji ? <span style={{ fontSize: 28 }}>{p.emoji}</span> : img ? <img src={img} alt={name} /> : <span style={{ fontSize: 22, color: "#a1a1a6" }}>○</span>}
                </div>
                <div className="cart-row-info">
                  <h3>{name}</h3>
                  <div className="cart-row-sku">{sku}</div>
                  <div className="cart-row-price">{ars(price)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <div className="cart-qty">
                      <button onClick={() => updateQty(key, -1)} aria-label="Restar">−</button>
                      <span>{p.qty}</span>
                      <button onClick={() => updateQty(key, +1)} aria-label="Sumar">+</button>
                    </div>
                    <button className="cart-remove" onClick={() => removeFromCart(key)}>Eliminar</button>
                  </div>
                </div>
                <div className="cart-row-actions">
                  <span className="cart-row-total">{ars(price * p.qty)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="cart-summary">
          <h2>Resumen</h2>
          {hasFree ? <div className="ship-notice">Envío gratis</div> : <div className="ship-notice ship-notice--muted">Te faltan {ars(remaining)} para envío gratis</div>}
          <div className="row"><span>Subtotal</span><span>{ars(subtotal)}</span></div>
          <div className="row"><span>Envío</span><span className={hasFree ? "free" : ""}>{hasFree ? "Gratis" : ars(shipping)}</span></div>
          <div className="row total"><span>Total</span><b>{ars(total)}</b></div>
          <button className="checkout" onClick={() => setCheckoutOpen(true)}>Comprar</button>
          <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>Compra protegida</p>
        </div>
      </div>

      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
    </div>
  )
}
