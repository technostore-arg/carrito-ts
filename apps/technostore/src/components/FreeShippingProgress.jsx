import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'

/** Barra de progreso hacia el envío gratis (constante FREE_SHIPPING_THRESHOLD). */
export default function FreeShippingProgress({ compact = false }) {
  const { subtotalFinal, freeShippingRemaining, freeShippingProgress, freeUnlocked } = useCart()
  if (subtotalFinal <= 0) return null
  return (
    <div className={`ship-progress ${compact ? 'ship-progress--compact' : ''}`}>
      <p className={freeUnlocked ? 'ship-progress__msg ship-progress__msg--ok' : 'ship-progress__msg'}>
        {freeUnlocked ? '✓ ¡Envío gratis desbloqueado!' : `Te faltan ${ars(freeShippingRemaining)} para envío gratis`}
      </p>
      <div className="ship-progress__track" role="progressbar" aria-valuenow={freeShippingProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso hacia envío gratis">
        <div className="ship-progress__fill" style={{ width: `${freeShippingProgress}%` }} />
      </div>
    </div>
  )
}
