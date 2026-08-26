import { useEffect } from 'react'
import {
  useCart,
  FREE_SHIPPING_THRESHOLD,
} from '../context/CartContext'
import { ars } from '../utils/format'

export default function CartDrawer({ onCheckout }) {
  const {
    detailed,
    count,
    subtotal,
    shipping,
    total,
    updateQty,
    removeFromCart,
    clearCart,
    cartOpen,
    setCartOpen,
  } = useCart()

  useEffect(() => {
    document.body.classList.toggle('locked', cartOpen)
  }, [cartOpen])

  if (!cartOpen) return null

  const remaining = FREE_SHIPPING_THRESHOLD - subtotal
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)

  return (
    <>
      <div className="overlay" onClick={() => setCartOpen(false)} />
      <aside className="drawer" aria-label="Carrito de compras">
        <header className="drawer-head">
          <h2>🛒 Tu carrito <em>({count})</em></h2>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {detailed.length === 0 ? (
          <div className="cart-empty">
            <span>🛒</span>
            <h3>Tu carrito está vacío</h3>
            <p>Agregá GPUs, memorias o un rig completo y aparecerá acá.</p>
            <button className="btn-primary" onClick={() => setCartOpen(false)}>
              Explorar hardware IA
            </button>
          </div>
        ) : (
          <>
            <div className="ship-bar">
              <p>
                {remaining > 0 ? (
                  <>Te faltan <b>{ars(remaining)}</b> para el <b>envío gratis</b> 🚚</>
                ) : (
                  <>🎉 ¡Tenés <b>envío gratis</b> en este pedido!</>
                )}
              </p>
              <div className="track">
                <div className="fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="drawer-items">
              {detailed.map(p => (
                <div key={p.id} className="cart-item">
                  <div className="thumb">{p.emoji}</div>
                  <div className="ci-info">
                    <h4>{p.name}</h4>
                    <small>{ars(p.price)} c/u{p.vram ? ` · ${p.vram}GB VRAM` : ''}</small>
                    <div className="qty">
                      <button onClick={() => updateQty(p.id, -1)} aria-label="Restar">−</button>
                      <span>{p.qty}</span>
                      <button onClick={() => updateQty(p.id, +1)} aria-label="Sumar">+</button>
                      <button className="remove" onClick={() => removeFromCart(p.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                  <b className="ci-price">{ars(p.price * p.qty)}</b>
                </div>
              ))}
            </div>

            <footer className="drawer-foot">
              <div className="row">
                <span>Subtotal</span>
                <span>{ars(subtotal)}</span>
              </div>
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
              <button className="btn-primary checkout" onClick={onCheckout}>
                Finalizar compra con MercadoPago →
              </button>
              <button className="link-danger" onClick={clearCart}>
                Vaciar carrito
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
