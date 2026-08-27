import { motion } from "framer-motion"
import ProductCard from "./ProductCard"
import { StaggerGrid, RevealCard } from "../hooks/motion"

function SkeletonCard() {
  return (
    <div className="card" aria-hidden>
      <div className="card-media" style={{ background: "var(--bg-alt)" }}>
        <div className="skeleton shimmer" style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="card-body">
        <div className="skeleton" style={{ width: 60, height: 10, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: "80%", height: 16, borderRadius: 6, marginTop: 10 }} />
        <div className="skeleton" style={{ width: "60%", height: 12, borderRadius: 6, marginTop: 8 }} />
        <div className="skeleton" style={{ width: 90, height: 20, borderRadius: 8, marginTop: 14 }} />
      </div>
    </div>
  )
}

export default function ProductGrid({ products, totalLabel, onReset }) {
  if (!products) {
    return (
      <>
        <p className="grid-count">Cargando…</p>
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
        <h3>No encontramos productos</h3>
        <p>Probá con otros filtros o buscá otra cosa.</p>
        <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="btn-ghost" onClick={onReset}>
          Ver todo el catálogo
        </motion.button>
      </motion.div>
    )
  }

  return (
    <>
      <p className="grid-count">{totalLabel}</p>
      <StaggerGrid className="product-grid">
        {products.map((p, i) => (
          <RevealCard key={p.sku} index={i}>
            <ProductCard producto={p} />
          </RevealCard>
        ))}
      </StaggerGrid>
    </>
  )
}
