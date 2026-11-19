import { useState, useEffect } from "react"
import ProductCard from "./ProductCard"

const PAGE_SIZE = 24

export default function ProductGrid({ products, totalLabel, onReset, onDetail, onAddToCart }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [products])

  if (!products) {
    return (
      <>
        <p className="ts-catalog-count">Cargando…</p>
        <div className="ts-product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ts-product-card ts-product-card--skeleton" aria-hidden>
              <div className="ts-product-card__media"><div className="ts-skeleton-media" /></div>
              <div className="ts-product-card__body">
                <div className="ts-skeleton ts-skeleton--title" />
                <div className="ts-skeleton ts-skeleton--sub" />
                <div className="ts-skeleton" />
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }
  if (products.length === 0) {
    return (
      <div className="ts-empty-state">
        <span className="ts-empty-state__icon" aria-hidden>○</span>
        <h3>No encontramos productos</h3>
        <p className="ts-muted">Probá con otros filtros.</p>
        <button className="ts-btn ts-btn--ghost" onClick={onReset}>Ver todo el catálogo</button>
      </div>
    )
  }

  const shown = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length

  return (
    <>
      <div className="ts-product-grid">
        {shown.map(p => (
          <ProductCard key={p.sku} producto={p} onDetail={onDetail} onAddToCart={onAddToCart} />
        ))}
      </div>
      {hasMore && (
        <div className="ts-show-more">
          <span className="ts-show-more__count">Mostrando {shown.length} de {products.length}</span>
          <button className="ts-btn ts-btn--ghost ts-show-more__btn" onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, products.length))}>
            Cargar más ({products.length - shown.length} restantes)
          </button>
        </div>
      )}
    </>
  )
}
