import { useMemo } from "react"
import { ars } from "../utils/format"
import { specChips } from "../utils/specs"
import { getBrand } from "../utils/brand"

/**
 * Bloque destacado de productos Apple en la home.
 * Muestra una muestra (usados primero) + botón "Ver todo Apple" que activa el filtro de marca.
 */
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
    <section className="apple-spotlight" aria-label="Productos Apple destacados">
      <div className="container">
        <div className="spotlight-head">
          <div>
            <span className="eyebrow">Selección Apple</span>
            <h2>
              Apple en TechnoStore
            </h2>
            <p className="muted">iPhone nuevos y usados con garantía de 30 días, Mac y accesorios. Un solo lugar para todo el ecosistema.</p>
          </div>
          <button className="btn-ghost spotlight-all" onClick={onVerTodos}>Ver todo Apple →</button>
        </div>
        <div className="spotlight-row">
          {apple.map(p => {
            const usado = p.condicion === "usado"
            const e = p.especificaciones || {}
            const chips = specChips(p)
            return (
              <button type="button" key={p.sku} className="spotlight-card" onClick={() => onOpen?.(p)}>
                <div className="spotlight-media">
                  {p.imagenes?.[0] ? <img src={p.imagenes[0]} alt={p.nombre} loading="lazy" decoding="async" /> : <span aria-hidden>○</span>}
                  <span className={`badge ${usado ? "badge--usado" : ""}`}>{usado ? `Usado · Bat ${e._bateria}%` : "Nuevo"}</span>
                </div>
                <div className="spotlight-body">
                  <h3 title={p.nombre}>{p.nombre}</h3>
                  {chips.length > 0 && (
                    <div className="spotlight-chips">
                      {chips.slice(0, 3).map((c, i) => <span key={i}>{c}</span>)}
                    </div>
                  )}
                  <div className="spotlight-price">
                    <strong>{ars(p.precio_transferencia ?? p.precio)}</strong>
                    {usado && e._calidad && <em>Calidad {e._calidad}</em>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
