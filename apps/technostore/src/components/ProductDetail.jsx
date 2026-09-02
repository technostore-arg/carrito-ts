import { useEffect } from "react"
import { motion } from "framer-motion"
import { ars, waLink } from "../utils/format"

export default function ProductDetail({ producto, onClose }) {
  useEffect(() => {
    document.body.classList.add("locked")
    return () => document.body.classList.remove("locked")
  }, [])
  if (!producto) return null
  const { nombre, descripcion, categoria, tipo_venta, precio, stock, especificaciones, imagenes, sku, marca } = producto
  const foto = imagenes?.[0]
  const esEncargo = tipo_venta === "encargo"
  const waHref = esEncargo ? waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <button className="close icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>

        {foto && (
          <div style={{ width: "100%", height: 320, borderRadius: 14, overflow: "hidden", marginBottom: 20, background: "#0f141f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={foto} alt={nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="brand">{sku}</span>
          {marca && <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--glass)", padding: "2px 8px", borderRadius: 6 }}>{marca}</span>}
          <span className={`badge ${esEncargo ? "badge--encargo" : ""}`} style={{ position: "static" }}>{esEncargo ? "A pedido" : categoria}</span>
        </div>

        <h2 className="modal-title" style={{ marginBottom: 12 }}>{nombre}</h2>

        {descripcion && (
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>{descripcion}</p>
        )}

        {especificaciones && Object.keys(especificaciones).length > 0 && (() => {
          const cleanSpecs = Object.entries(especificaciones).filter(([k]) => !k.startsWith('_'))
          if (cleanSpecs.length === 0) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Especificaciones</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {cleanSpecs.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ color: "var(--muted)", fontWeight: 600 }}>{k}</span>
                    <span style={{ fontFamily: "monospace" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            {esEncargo ? (
              <span className="price price--encargo">A consultar</span>
            ) : (
              <>
                <span className="price">{ars(precio)}</span>
                <span className="price-note" style={{ marginLeft: 8 }}>IVA incl.</span>
              </>
            )}
            {!esEncargo && stock != null && (
              <span style={{ fontSize: 12, color: stock <= 4 ? "var(--amber)" : "var(--muted)", marginLeft: 12 }}>
                {stock <= 4 ? `Últimas ${stock} unidades` : `Stock: ${stock}`}
              </span>
            )}
          </div>

          {esEncargo ? (
            <a className="add-btn" href={waHref} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              Consultar por WhatsApp
            </a>
          ) : (
            <button className="add-btn" onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
