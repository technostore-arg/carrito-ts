import { useCart } from '../context/CartContext.jsx'
import { ars } from '../utils/format.js'

/** Barra de progreso hacia el envío gratis (FREE_SHIPPING_THRESHOLD). */
export default function FreeShippingProgress({ compact = false }) {
  const { subtotalFinal, freeShippingRemaining, freeShippingProgress, freeUnlocked } = useCart()
  if (subtotalFinal <= 0) return null
  return (
    <div className={['ts-ship-progress', compact ? 'ts-ship-progress--compact' : ''].join(' ')}>
      <p className={['ts-ship-progress__msg', freeUnlocked ? 'is-ok' : ''].join(' ')}>
        {freeUnlocked ? '✓ ¡Envío gratis desbloqueado!' : `Te faltan ${ars(freeShippingRemaining)} para envío gratis`}
      </p>
      <div className="ts-ship-progress__track" role="progressbar" aria-valuenow={freeShippingProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso hacia envío gratis">
        <div className="ts-ship-progress__fill" style={{ width: `${freeShippingProgress}%` }} />
      </div>
    </div>
  )
}
