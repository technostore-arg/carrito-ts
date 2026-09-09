import { ars, waLink } from "../utils/format"
import { specChips } from "../utils/specs"

export default function ProductCard({ producto, onAddToCart, onDetail }) {
  const { nombre, categoria, tipo_venta, stock, imagenes, sku, name, precio_transferencia, precio_mercadopago } = producto
  const displayName = nombre || name
  const foto = imagenes?.[0]
  const chips = specChips(producto)
  const esEncargo = tipo_venta === "encargo"

  const handleEncargo = () => {
    try { fetch("/api/consultas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, nombre: displayName, marca: producto.marca, mensaje: `Hola, quiero consultar por ${displayName} (SKU: ${sku})`, origen: "whatsapp" }) }).catch(() => {}) } catch {}
  }

  const waHref = esEncargo ? waLink(`Hola, quiero consultar por ${displayName} (SKU: ${sku})`) : null

  return (
    <article className="card" onClick={() => onDetail?.(producto)} style={{ cursor: "pointer" }}>
      <div className="card-media">
        {foto ? <img src={foto} alt={displayName} loading="lazy" decoding="async" /> : <div className="fallback" aria-hidden>○</div>}
        <span className={`badge ${esEncargo ? "badge--encargo" : ""}`}>{esEncargo ? "A pedido" : categoria}</span>
      </div>
      <div className="card-body">
        <span className="brand">{sku}</span>
        <h3 title={displayName}>{displayName}</h3>
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "0 0 8px" }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text)", background: "#f0f4ff", border: "1px solid #dbe4ff", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{c}</span>
            ))}
          </div>
        )}
        {!esEncargo && <p style={{ fontSize: 11, color: "var(--amber)", margin: "0 0 8px", fontWeight: 500 }}>Recomendamos consultar stock antes de comprar</p>}
        {esEncargo ? (
          <div className="price-row"><span className="price price--encargo">A consultar</span></div>
        ) : (
          <div className="price-row"><span className="price">{ars(precio_transferencia)}</span></div>
        )}
        <div className="card-actions">
          {esEncargo ? (
            <a className="add-btn" href={waHref} target="_blank" rel="noreferrer" onClick={e => { e.stopPropagation(); handleEncargo() }}>Consultar</a>
          ) : (
            <button className="add-btn" onClick={e => { e.stopPropagation(); onAddToCart?.(producto) }}>Agregar</button>
          )}
          <button className="add-btn add-btn--ghost" onClick={e => { e.stopPropagation(); onDetail?.(producto) }}>Detalle</button>
        </div>
      </div>
    </article>
  )
}
