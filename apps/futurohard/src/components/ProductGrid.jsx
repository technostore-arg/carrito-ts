import { useState, useEffect } from "react"
import ProductCard from "./ProductCard"

const PAGE_SIZE = 24

function SkeletonCard() {
  return (
    <div className="card" aria-hidden>
      <div className="card-media"><div className="skeleton shimmer" style={{ width: "100%", height: "100%" }} /></div>
      <div className="card-body">
        <div className="skeleton" style={{ width: 70, height: 10, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "85%", height: 15, borderRadius: 6, marginTop: 10 }} />
        <div className="skeleton" style={{ width: "60%", height: 11, borderRadius: 6, marginTop: 8 }} />
        <div className="skeleton" style={{ width: 100, height: 18, borderRadius: 8, marginTop: 14 }} />
      </div>
    </div>
  )
}

export default function ProductGrid({ products, totalLabel, onReset, onDetail, onAddToCart }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [products])

  if (!products) {
    return (
      <>
        <p className="grid-count">Cargando…</p>
        <div className="product-grid">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      </>
    )
  }
  if (products.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-emoji">○</span>
        <h3>Sin resultados</h3>
        <p>Probá con otra categoría o búsqueda.</p>
        <button className="btn-ghost" onClick={onReset}>Ver catálogo completo</button>
      </div>
    )
  }
  const shown = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length

  return (
    <>
      <p className="grid-count">{totalLabel}</p>
      <div className="product-grid">
        {shown.map(p => (
          <ProductCard key={p.sku || p.id} producto={p} onDetail={onDetail} onAddToCart={onAddToCart} />
        ))}
      </div>
      {hasMore && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0 32px" }}>
          <span className="muted" style={{ fontSize: 11 }}>Mostrando {shown.length} de {products.length}</span>
          <button className="btn-ghost" onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, products.length))}>
            Cargar más ({products.length - shown.length} restantes)
          </button>
        </div>
      )}
    </>
  )
}
