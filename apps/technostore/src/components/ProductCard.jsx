import { specChips } from '../utils/specs.js'
import { waLink } from '../utils/format.js'
import PriceBlock from './PriceBlock.jsx'
import StockBadge from './StockBadge.jsx'
import { stockState, STOCK_LABELS } from '../utils/stock.js'
import ProductMedia from './ProductMedia.jsx'

/** Tarjeta de producto con precio dual, badges de stock e imagen lazy. */
export default function ProductCard({ producto, onAddToCart, onDetail }) {
  const { nombre, categoria, imagenes, sku } = producto
  const chips = specChips(producto)
  const state = stockState(producto)
  const sinCompra = state === 'agotado' || state === 'encargo'
  const esUsado = producto.condicion === 'usado'
  const foto = imagenes?.[0]
  const consulta = waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`)

  const consultar = () => {
    try {
      fetch('/api/consultas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, nombre, marca: producto.marca, mensaje: `Consulta por ${nombre}`, origen: 'whatsapp' }),
      }).catch(() => {})
    } catch { /* el link de WhatsApp funciona igual */ }
  }

  return (
    <article className="card" onClick={() => onDetail?.(producto)} style={{ cursor: 'pointer' }}>
      <div className="card-media">
        <ProductMedia src={foto} alt={nombre} className="card-media__img" />
        <span className={`badge ${state === 'encargo' ? 'badge--encargo' : ''}`}>{state === 'encargo' ? 'A pedido' : categoria}</span>
        <StockBadge producto={producto} compact />
        {esUsado && <span className="badge badge--usado">Usado · 30 días</span>}
      </div>
      <div className="card-body">
        <span className="brand">{sku}</span>
        <h3 title={nombre}>{nombre}</h3>
        {chips.length > 0 && (
          <div className="spec-chips">
            {chips.map((c, i) => <span key={i}>{c}</span>)}
          </div>
        )}
        <PriceBlock producto={producto} compact />
        <div className="card-actions">
          {sinCompra ? (
            <a className="add-btn" href={consulta} target="_blank" rel="noreferrer" onClick={e => { e.stopPropagation(); consultar() }}>Consultar</a>
          ) : (
            <button className="add-btn" onClick={e => { e.stopPropagation(); onAddToCart?.(producto) }}>Agregar</button>
          )}
          <button className="add-btn add-btn--ghost" onClick={e => { e.stopPropagation(); onDetail?.(producto) }}>Detalle</button>
        </div>
        {state === 'agotado' && <span className="card-stock-note">{STOCK_LABELS.agotado}</span>}
      </div>
    </article>
  )
}
