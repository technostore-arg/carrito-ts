import { motion, useReducedMotion } from "framer-motion"
import { ars, waLink } from "@technostore/ui/src/format"
import Badge from "@technostore/ui/src/Badge"

function SpecChips({ especificaciones }) {
  const entries = Object.entries(especificaciones || {}).slice(0, 3)
  if (entries.length === 0) return null
  return (
    <div className="spec-chips">
      {entries.map(([k, v]) => (
        <span key={k} className="spec-chip">
          <strong>{k}:</strong> {String(v)}
        </span>
      ))}
    </div>
  )
}

export default function ProductCard({ producto }) {
  const shouldReduce = useReducedMotion()
  const { nombre, descripcion, categoria, tipo_venta, precio, stock, especificaciones, imagenes, sku } = producto
  const foto = imagenes?.[0]
  const esEncargo = tipo_venta === "encargo"

  return (
    <motion.article
      className="card card--fh"
      whileHover={shouldReduce ? undefined : { y: -4 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ willChange: "transform" }}
    >
      <div className="card-media">
        {foto ? <img src={foto} alt={nombre} loading="lazy" /> : <div className="fallback" aria-hidden />}
        <Badge deal={false}>{categoria}</Badge>
        {esEncargo && <span className="badge badge--encargo" style={{ left: "auto", right: 12 }}>A pedido</span>}
        {!esEncargo && stock != null && stock <= 3 && <span className="stock-warn">Últimas {stock}</span>}
      </div>

      <div className="card-body">
        <span className="brand mono">{sku}</span>
        <h3 title={nombre}>{nombre}</h3>
        {descripcion && <p className="card-desc">{descripcion}</p>}
        <SpecChips especificaciones={especificaciones} />
        <div className="price-row" style={{ marginTop: 12 }}>
          {esEncargo ? <span className="price price--encargo">A consultar</span> : <><span className="price">{ars(precio)}</span><span className="price-note">IVA incl.</span></>}
        </div>

        {esEncargo ? (
          <motion.a whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="add-btn" href={waLink(nombre, sku)} target="_blank" rel="noreferrer" onClick={() => { try { fetch("/api/consultas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, nombre, marca: producto.marca, mensaje: `Hola, quiero consultar por ${nombre} (SKU: ${sku})`, origen: "whatsapp" }) }).catch(() => {}) } catch {} }} aria-label={`Consultar por ${nombre} vía WhatsApp`}>
            Consultar por WhatsApp
          </motion.a>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="add-btn add-btn--ghost" onClick={() => alert(`Demo Fase 4: ${nombre} — agregar al carrito en Fase 5`)}>
            Ver detalle
          </motion.button>
        )}
      </div>
    </motion.article>
  )
}
