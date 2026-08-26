import { useCart } from '../context/CartContext'
import { ars } from '../utils/format'

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
  return (
    <article className="card">
      <div className="card-media">
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="fallback" />}
        {product.badge && !discount && <span className="badge">{product.badge}</span>}
        {discount > 0 && <span className="badge deal">-{discount}%</span>}
        {product.vram >= 16 && <span className="vram-chip">{product.vram}GB</span>}
      </div>
      <div className="card-body">
        <span className="brand">{product.brand}</span>
        <h3>{product.name}</h3>
        <span className="spec-line">{product.specs?.slice(0, 2).join(' · ')}</span>
        <div className="price-row">
          <span className="price">{ars(product.price)}</span>
          {product.oldPrice && <span className="old-price">{ars(product.oldPrice)}</span>}
        </div>
        <button className="add-btn" onClick={() => addToCart(product)}>Agregar</button>
      </div>
    </article>
  )
}
