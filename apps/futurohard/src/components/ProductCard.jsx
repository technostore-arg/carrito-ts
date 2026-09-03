import { ars, waLink } from "../utils/format"

export default function ProductCard({ producto, onAddToCart, onDetail }) {
  const { nombre, categoria, tipo_venta, stock, imagenes, sku, name, precio_transferencia, precio_mercadopago } = producto
  const displayName = nombre || name
  const foto = imagenes?.[0]
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
        {!esEncargo && stock != null && stock <= 3 && <span className="stock-warn">Últimas {stock}</span>}
      </div>
      <div className="card-body">
        <span className="brand">{sku}</span>
        <h3 title={displayName}>{displayName}</h3>
        {esEncargo ? (
          <div className="price-row"><span className="price price--encargo">A consultar</span></div>
        ) : (
          <div className="price-dual">
            <div className="price-transfer">
              <span className="price-label">Transferencia</span>
              <span className="price">{ars(precio_transferencia)}</span>
            </div>
            <div className="price-mp">
              <span className="price-label">MercadoPago</span>
              <span className="price price--mp">{ars(precio_mercadopago)}</span>
            </div>
          </div>
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
