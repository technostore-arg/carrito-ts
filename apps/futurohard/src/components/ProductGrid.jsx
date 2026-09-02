import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import ProductCard from "./ProductCard"
import { StaggerGrid, RevealCard } from "../hooks/motion"

const PAGE_SIZE = 24

function SkeletonCard() {
  return (
    <div className="card card--fh" aria-hidden>
      <div className="card-media" style={{ background: "var(--bg-alt)" }}>
        <div className="skeleton shimmer" style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="card-body">
        <div className="skeleton" style={{ width: 70, height: 10, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "85%", height: 15, borderRadius: 6, marginTop: 10 }} />
        <div className="skeleton" style={{ width: "60%", height: 11, borderRadius: 6, marginTop: 8 }} />
        <div className="skeleton" style={{ width: 100, height: 18, borderRadius: 8, marginTop: 14 }} />
      </div>
    </div>
  )
}

export default function ProductGrid({ products, totalLabel, onReset, onDetail }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [products])

  if (!products) {
    return (
      <>
        <p className="grid-count mono" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
          Cargando…
        </p>
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </>
    )
  }

  if (products.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }} className="empty-state">
        <span className="empty-emoji">🔎</span>
        <h3>Sin resultados</h3>
        <p>Probá con otra categoría o búsqueda técnica (ej. “48GB”, “Gen5”).</p>
        <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="btn-ghost" onClick={onReset}>
          Ver catálogo completo
        </motion.button>
      </motion.div>
    )
  }

  const shown = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length

  return (
    <>
      <p className="grid-count mono" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
        {totalLabel}
      </p>
      <StaggerGrid className="product-grid">
        {shown.map((p, i) => (
          <RevealCard key={p.sku} index={i}>
            <ProductCard producto={p} onDetail={onDetail} />
          </RevealCard>
        ))}
      </StaggerGrid>
      {hasMore && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0 32px" }}>
          <span className="muted" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>Mostrando {shown.length} de {products.length}</span>
          <button className="btn-ghost" onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, products.length))}>
            Cargar más ({products.length - shown.length} restantes)
          </button>
        </div>
      )}
    </>
  )
}
