import { useEffect } from 'react'
import { waLink } from '../utils/format.js'
import PriceBlock from './PriceBlock.jsx'
import StockBadge from './StockBadge.jsx'
import { stockState } from '../utils/stock.js'
import ProductMedia from './ProductMedia.jsx'

/** Detalle de producto: mismos precios duales y badges que la tarjeta. */
export default function ProductDetail({ producto, onClose, onAddToCart }) {
  useEffect(() => {
    document.body.classList.add('locked')
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => { document.body.classList.remove('locked'); window.removeEventListener('keydown', h) }
  }, [onClose])

  if (!producto) return null
  const { nombre, descripcion, categoria, imagenes, sku, marca, especificaciones } = producto
  const state = stockState(producto)
  const sinCompra = state === 'agotado' || state === 'encargo'
  const waHref = waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`)

  const specs = Object.entries(especificaciones || {}).filter(([k]) => !k.startsWith('_'))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--product" onClick={e => e.stopPropagation()}>
        <button className="close icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        <ProductMedia src={imagenes?.[0]} alt={nombre} className="detail-media" eager />
        <div className="detail-badges">
          <span className="brand">{sku}</span>
          {marca && <span className="detail-chip">{marca}</span>}
          <span className="badge badge--static">{categoria}</span>
          <StockBadge producto={producto} />
          {producto.condicion === 'usado' && <span className="badge badge--usado badge--static">Usado · {producto.garantia || 'garantía'}</span>}
        </div>
        <h2 className="modal-title">{nombre}</h2>
        {descripcion && <p className="detail-desc">{descripcion}</p>}

        {specs.length > 0 && (
          <div className="detail-specs">
            <h4>Especificaciones</h4>
            {specs.map(([k, v]) => (
              <div key={k}><span>{k}</span><span>{String(v)}</span></div>
            ))}
          </div>
        )}

        <div className="detail-buy">
          <PriceBlock producto={producto} />
          {sinCompra ? (
            <a className="add-btn" href={waHref} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
          ) : (
            <button className="add-btn" onClick={() => { onAddToCart?.(producto); onClose() }}>Agregar al carrito</button>
          )}
        </div>
      </div>
    </div>
  )
}
