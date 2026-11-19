import { useMemo } from "react"
import ProductMedia from './ProductMedia.jsx'
import { ars } from "../utils/format"
import { specChips } from "../utils/specs"
import { getBrand } from "../utils/brand"

/** Bloque destacado de productos Apple en la home (usados primero, un solo lugar para el ecosistema). */
export default function AppleSpotlight({ products, onOpen, onVerTodos }) {
  const apple = useMemo(() => {
    const list = (products || []).filter(p => getBrand(p) === "Apple")
    return list
      .map((p, i) => ({ p, i }))
      .sort((a, b) => {
        const ua = a.p.condicion === "usado" ? 0 : 1
        const ub = b.p.condicion === "usado" ? 0 : 1
        if (ua !== ub) return ua - ub
        return a.i - b.i
      })
      .slice(0, 8)
      .map(x => x.p)
  }, [products])

  if (apple.length === 0) return null

  return (
    <section className="ts-spotlight" aria-label="Productos Apple destacados">
      <div className="ts-spotlight__head">
        <div>
          <span className="ts-spotlight__eyebrow">Selección Apple</span>
          <h2 className="ts-spotlight__title">Apple en TechnoStore</h2>
          <p className="ts-spotlight__sub">iPhone nuevos y usados con garantía de 30 días, Mac y accesorios. Un solo lugar para todo el ecosistema.</p>
        </div>
        <button className="ts-btn ts-btn--ghost ts-spotlight__all" onClick={onVerTodos}>Ver todo Apple →</button>
      </div>
      <div className="ts-spotlight__row">
        {apple.map(p => {
          const usado = p.condicion === "usado"
          const e = p.especificaciones || {}
          const chips = specChips(p)
          return (
            <button type="button" key={p.sku} className="ts-spotlight-card" onClick={() => onOpen?.(p)}>
              <div className="ts-spotlight-card__media">
                <ProductMedia src={p.imagenes?.[0]} alt={p.nombre} />
                <span className={`ts-badge ${usado ? 'ts-badge--used' : 'ts-badge--new'}`}>{usado ? `Usado · Bat ${e._bateria}%` : 'Nuevo'}</span>
              </div>
              <div className="ts-spotlight-card__body">
                <h3 className="ts-spotlight-card__name" title={p.nombre}>{p.nombre}</h3>
                {chips.length > 0 && (
                  <div className="ts-spotlight-card__chips">
                    {chips.slice(0, 3).map((c, i) => <span key={i}>{c}</span>)}
                  </div>
                )}
                <div className="ts-spotlight-card__price">
                  <strong>{ars(p.precio_transferencia ?? p.precio)}</strong>
                  {usado && e._calidad && <em>Calidad {e._calidad}</em>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
