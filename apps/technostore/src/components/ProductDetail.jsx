import { useEffect } from "react"
import { ars, waLink } from "../utils/format"

export default function ProductDetail({ producto, onClose, onAddToCart }) {
  useEffect(() => {
    document.body.classList.add("locked")
    const h = e => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", h)
    return () => { document.body.classList.remove("locked"); window.removeEventListener("keydown", h) }
  }, [onClose])
  if (!producto) return null
  const { nombre, descripcion, categoria, tipo_venta, precio, stock, especificaciones, imagenes, sku, marca } = producto
  const foto = imagenes?.[0]
  const esEncargo = tipo_venta === "encargo"
  const waHref = esEncargo ? waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`) : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="close icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        {foto && (
          <div style={{ width: "100%", height: 320, borderRadius: 12, overflow: "hidden", marginBottom: 16, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <img src={foto} alt={nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span className="brand">{sku}</span>
          {marca && <span style={{ fontSize: 11, color: "var(--muted)", background: "#f5f5f7", padding: "2px 8px", borderRadius: 6 }}>{marca}</span>}
          <span className={`badge ${esEncargo ? "badge--encargo" : ""}`} style={{ position: "static" }}>{esEncargo ? "A pedido" : categoria}</span>
        </div>
        <h2 className="modal-title" style={{ marginBottom: 10 }}>{nombre}</h2>
        {descripcion && <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>{descripcion}</p>}
        {especificaciones && Object.keys(especificaciones).length > 0 && (() => {
          const clean = Object.entries(especificaciones).filter(([k]) => !k.startsWith('_'))
          if (clean.length === 0) return null
          return (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Especificaciones</h4>
              <div style={{ display: "grid", gap: 6 }}>
                {clean.map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "#f5f5f7", fontSize: 12.5 }}>
                    <span style={{ color: "var(--muted)", fontWeight: 500 }}>{k}</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            {esEncargo ? <span className="price price--encargo">A consultar</span> : <><span className="price">{ars(precio)}</span><span className="price-note" style={{ marginLeft: 6 }}>IVA incl.</span></>}
            {!esEncargo && stock != null && <span style={{ fontSize: 11, color: stock <= 4 ? "var(--amber)" : "var(--muted)", marginLeft: 10 }}>{stock <= 4 ? `Últimas ${stock}` : `Stock: ${stock}`}</span>}
          </div>
          {esEncargo ? <a className="add-btn" href={waHref} target="_blank" rel="noreferrer">Consultar por WhatsApp</a> : <button className="add-btn" onClick={() => { onAddToCart?.(producto); onClose() }}>Agregar al carrito</button>}
        </div>
      </div>
    </div>
  )
}
