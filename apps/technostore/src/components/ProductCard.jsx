import { motion, useReducedMotion } from "framer-motion"
import { ars, waLink } from "../utils/format"

function specsPreview(especificaciones) {
  const entries = Object.entries(especificaciones || {}).slice(0, 2)
  if (entries.length === 0) return null
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ")
}

export default function ProductCard({ producto, onAddToCart }) {
  const shouldReduce = useReducedMotion()
  const { nombre, descripcion, categoria, tipo_venta, precio, stock, especificaciones, imagenes, sku } = producto
  const foto = imagenes?.[0]
  const esEncargo = tipo_venta === "encargo"
  const preview = specsPreview(especificaciones)
  const waHref = esEncargo ? waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`) : null

  const handleEncargo = () => {
    try { fetch("/api/consultas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, nombre, marca: producto.marca, mensaje: `Hola, quiero consultar por ${nombre} (SKU: ${sku})`, origen: "whatsapp" }) }).catch(() => {}) } catch {}
  }

  return (
    <motion.article
      className="card"
      whileHover={shouldReduce ? undefined : { y: -4 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ willChange: "transform" }}
    >
      <div className="card-media">
        {foto ? <img src={foto} alt={nombre} loading="lazy" /> : <div className="fallback" aria-hidden />}
        <span className={`badge ${esEncargo ? "badge--encargo" : ""}`}>{esEncargo ? "A pedido" : categoria}</span>
        {!esEncargo && stock != null && stock <= 4 && <span className="stock-warn">Últimas {stock}</span>}
      </div>

      <div className="card-body">
        <span className="brand">{sku}</span>
        <h3 title={nombre}>{nombre}</h3>
        {descripcion && <p className="card-desc">{descripcion}</p>}
        {preview && <span className="spec-line">{preview}</span>}

        <div className="price-row">
          {esEncargo ? (
            <span className="price price--encargo">A consultar</span>
          ) : (
            <>
              <span className="price">{ars(precio)}</span>
              <span className="price-note">IVA incl.</span>
            </>
          )}
        </div>

        <div className="card-meta">
          <span className="meta-dot" />
          <small>{esEncargo ? "Entrega a pedido" : `Stock: ${stock}`}</small>
        </div>

        {esEncargo ? (
          <motion.a whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="add-btn" href={waHref} target="_blank" rel="noreferrer" onClick={handleEncargo} aria-label={`Consultar por ${nombre} vía WhatsApp`}>
            Consultar por WhatsApp
          </motion.a>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} transition={{ duration: 0.15 }} className="add-btn add-btn--ghost" onClick={() => onAddToCart?.(producto)}>
            Agregar al carrito
          </motion.button>
        )}
      </div>
    </motion.article>
  )
}
