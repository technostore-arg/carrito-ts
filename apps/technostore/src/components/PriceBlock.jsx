import { ars } from '../utils/format.js'
import { priceInfo, installmentsLabel } from '../utils/pricing.js'

/**
 * Precio dual: transferencia/efectivo destacado + lista/tarjeta y cuotas.
 * @param {{producto:object, compact?:boolean}} props
 */
export default function PriceBlock({ producto, compact = false }) {
  const { lista, transferencia, porcentaje, ahorro } = priceInfo(producto)
  const cuotas = installmentsLabel(producto)
  if (!transferencia && !lista) return <div className="price-dual"><span className="price price--encargo">A consultar</span></div>

  return (
    <div className={`price-dual ${compact ? 'price-dual--compact' : ''}`}>
      <div className="price-dual__main">
        <span className="price-label">Transferencia / Efectivo</span>
        <span className="price price--transfer">{ars(transferencia)}</span>
        {porcentaje > 0 && <span className="price-save" aria-label={`Ahorrás ${ars(ahorro)}, ${porcentaje} por ciento`}>−{porcentaje}%</span>}
      </div>
      <div className="price-dual__alt">
        <span className="price-label">Lista / Tarjeta</span>
        <span className="price--mp">{ars(lista)}</span>
      </div>
      {!compact && cuotas && <span className="price-installments">{cuotas}</span>}
      {!compact && porcentaje > 0 && <span className="price-ahorro">Ahorrás {ars(ahorro)} pagando con transferencia</span>}
    </div>
  )
}
