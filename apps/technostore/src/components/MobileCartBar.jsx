import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'

/** Barra inferior fija (mobile): total + CTA en zona del pulgar. */
export default function MobileCartBar({ onOpenCart, onCheckout }) {
  const { count, total } = useCart()
  if (count === 0) return null
  return (
    <div className="ts-mobile-cart-bar" role="region" aria-label="Resumen del carrito">
      <button className="ts-mobile-cart-bar__info" onClick={onOpenCart} aria-label={`Ver carrito, ${count} productos`}>
        <span className="ts-mobile-cart-bar__badge">{count}</span>
        <span>
          <small className="ts-mobile-cart-bar__label">Ver carrito</small>
          <strong className="ts-mobile-cart-bar__total">{ars(total)}</strong>
        </span>
      </button>
      <button className="ts-mobile-cart-bar__cta" onClick={onCheckout}>Comprar</button>
    </div>
  )
}
