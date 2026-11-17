/**
 * Configuración central del store.
 * Toda constante de negocio (envío, cuotas, cupones, debounce) vive acá.
 * @typedef {'transferencia'|'efectivo'|'tarjeta'} PaymentMethod
 * @typedef {'local'|'supplier'} StockSource
 */

/** @type {number} */
export const FREE_SHIPPING_THRESHOLD = 300000
/** @type {number} */
export const SHIPPING_COST = 15000
/** @type {number} */
export const SEARCH_DEBOUNCE_MS = 250

/** Zonas de envío por código postal argentino (4 dígitos). */
export const SHIPPING_ZONES = [
  { desde: 1000, hasta: 1999, costo: SHIPPING_COST, label: 'CABA' },
  { desde: 2000, hasta: 2999, costo: SHIPPING_COST, label: 'Gran Buenos Aires' },
  { desde: 3000, hasta: 3999, costo: 22000, label: 'Buenos Aires interior' },
  { desde: 4000, hasta: 5999, costo: 26000, label: 'Centro del país' },
  { desde: 6000, hasta: 8999, costo: 32000, label: 'Interior' },
  { desde: 9000, hasta: 9999, costo: 38000, label: 'Patagonia / Sur' },
]

/** Cuotas disponibles para pago con tarjeta. */
export const INSTALLMENTS = [3, 6, 12]

/**
 * Cupones de demo aplicables en el carrito (sin llamada al servidor).
 * Cuando se integre el backend, reemplazar este objeto por un fetch.
 * @type {Record<string, {tipo:'porcentaje'|'fijo'|'envio', valor:number, etiqueta:string}>}
 */
export const COUPONS = {
  BIENVENIDA10: { tipo: 'porcentaje', valor: 10, etiqueta: '10% de descuento' },
  TECH5: { tipo: 'porcentaje', valor: 5, etiqueta: '5% de descuento' },
  ENVIOGRATIS: { tipo: 'envio', valor: 0, etiqueta: 'Envío gratis' },
  MIL: { tipo: 'fijo', valor: 1000, etiqueta: '$1.000 de descuento' },
}

/** @param {string} cp */
export function shippingZone(cp) {
  const n = Number(cp)
  if (!/^\d{4}$/.test(String(cp || ''))) return null
  return SHIPPING_ZONES.find(z => n >= z.desde && n <= z.hasta) || { desde: 0, hasta: 0, costo: SHIPPING_COST, label: 'Resto del país' }
}

/**
 * @param {string} cp
 * @param {number} subtotal
 * @returns {number}
 */
export function shippingCost(cp, subtotal) {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0
  return shippingZone(cp)?.costo ?? SHIPPING_COST
}

export const WHATSAPP_NUMBER = '5491127650658'
