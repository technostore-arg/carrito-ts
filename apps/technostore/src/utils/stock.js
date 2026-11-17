/**
 * Estados de disponibilidad derivados del origen del stock.
 * @typedef {'agotado'|'encargo'|'local'|'supplier'} StockState
 */
/** @param {object} producto @returns {StockState} */
export function stockState(producto) {
  if (Number(producto?.stock) === 0 && producto?.tipo_venta !== 'encargo') return 'agotado'
  if (producto?.tipo_venta === 'encargo') return 'encargo'
  return producto?.stock_source === 'supplier' ? 'supplier' : 'local'
}

export const STOCK_LABELS = {
  agotado: 'Sin stock',
  encargo: 'A pedido',
  local: 'Entrega inmediata · Retiro hoy',
  supplier: 'Despacho en 24–48 hs',
}
