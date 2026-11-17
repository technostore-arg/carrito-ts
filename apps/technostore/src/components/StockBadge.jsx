import { waLink } from '../utils/format.js'
import { stockState, STOCK_LABELS } from '../utils/stock.js'
export { stockState, STOCK_LABELS }

/** Badge de disponibilidad según origen del stock. */
export default function StockBadge({ producto, compact = false }) {
  const state = stockState(producto)
  return (
    <span className={`stock-badge stock-badge--${state} ${compact ? 'stock-badge--compact' : ''}`}>
      <span className="stock-dot" aria-hidden />
      {STOCK_LABELS[state]}
    </span>
  )
}

/** CTA para productos sin stock: consulta rápida por WhatsApp. */
export function StockConsult({ producto, className = 'add-btn' }) {
  const texto = `Hola, quiero consultar por ${producto?.nombre || producto?.name} (SKU: ${producto?.sku})`
  return (
    <a className={className} href={waLink(texto)} target="_blank" rel="noreferrer">
      Consultar por WhatsApp
    </a>
  )
}
