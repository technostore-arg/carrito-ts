import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'

/** Barra inferior fija (mobile): total + CTA en zona del pulgar. */
export default function MobileCartBar({ onOpenCart, onCheckout }) {
  const { count, total } = useCart()
  if (count === 0) return null
  return (
    <div className="mobile-cart-bar" role="region" aria-label="Resumen del carrito">
      <button className="mobile-cart-bar__info" onClick={onOpenCart} aria-label={`Ver carrito, ${count} productos`}>
        <span className="mobile-cart-bar__badge">{count}</span>
        <span>
          <small>Ver carrito</small>
          <strong>{ars(total)}</strong>
        </span>
      </button>
      <button className="mobile-cart-bar__cta" onClick={onCheckout}>Comprar</button>
    </div>
  )
}
