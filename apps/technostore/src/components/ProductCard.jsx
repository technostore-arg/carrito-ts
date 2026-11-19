/** Tarjeta de producto profesional: imagen, 3 specs clave, precio, badge de stock, un solo botón principal. */
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'
import ProductMedia from './ProductMedia.jsx'
import { specChips } from '../utils/specs.js'
import { stockState } from '../utils/stock.js'
import { ars } from '../utils/format.js'

export default function ProductCard({ producto, onAddToCart, onDetail }) {
  const { nombre, categoria, imagenes, sku } = producto
  const chips = specChips(producto).slice(0, 3)
  const state = stockState(producto)
  const foto = imagenes?.[0]
  const mainPrice = producto.precio_transferencia ?? producto.precio ?? 0
  const mpPrice = producto.precio_mercadopago

  return (
    <article className="ts-product-card">
      <div className="ts-product-card__media" role="img" aria-label={nombre}>
        <ProductMedia src={foto} alt={nombre} className="ts-product-card__media-img" />
        <div className="ts-product-card__badges">
          <Badge variant="discount">{categoria}</Badge>
          <Badge variant={state === 'encargo' ? 'encargo' : 'high'}>
            {state === 'encargo' ? 'A pedido' : (state === 'agotado' ? 'Sin stock' : `Stock ${producto.stock ?? 0}`)}
          </Badge>
        </div>
      </div>
      <div className="ts-product-card__body">
        <span className="ts-product-card__sku">{sku}</span>
        <h3 className="ts-product-card__title">{nombre}</h3>
        <div className="ts-product-card__specs">
          {chips.map((c, i) => <span key={i} className="ts-product-card__spec">{c}</span>)}
        </div>
        <div className="ts-product-card__price">
          <span className="ts-price">{ars(mainPrice)}</span>
          {mpPrice && Number(mpPrice) > mainPrice && <span className="ts-price__alt">{ars(mpPrice)}</span>}
        </div>
        <div className="ts-product-card__actions">
          <Button variant="primary" onClick={() => onAddToCart?.(producto)}>Agregar</Button>
          <Button variant="secondary" onClick={() => onDetail?.(producto)}>Detalle</Button>
        </div>
      </div>
    </article>
  )
}
