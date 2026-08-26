import ProductCard from './ProductCard'
import { Reveal } from '../hooks/motion'

export default function ProductGrid({ products, totalLabel, onReset }) {
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">🔎</span>
        <h3>No encontramos productos</h3>
        <p>Prueba con otra búsqueda o explora otra categoría.</p>
        <button className="btn-ghost" onClick={onReset}>
          Ver todo el catálogo
        </button>
      </div>
    )
  }

  return (
    <>
      <p className="grid-count">{totalLabel}</p>
      <div className="product-grid">
        {products.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i * 55, 385)}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </>
  )
}
