/**
 * Medios de pago y promociones informativas (Argentina, noviembre 2026).
 * Los importes, cuotas y beneficios REALES los define cada pasarela en su checkout.
 * Las promos requieren que el comercio esté adherido a la campaña: ver legales en cada link.
 */

export const GATEWAYS = [
  { id: 'mercadopago', name: 'Mercado Pago', logo: '/payments/mercadopago.svg', url: 'https://www.mercadopago.com.ar/' },
  { id: 'openpay', name: 'Openpay by BBVA', logo: '/payments/openpay.svg', url: 'https://www.openpayargentina.com.ar/' },
  { id: 'sipago', name: 'SiPago', logo: '/payments/sipago.svg', url: 'https://www.sipago.coop/' },
]

export const PAYMENT_METHODS = [
  { id: 'transferencia', label: 'Transferencia', note: 'Menor precio · con impuestos incluidos', gateway: null, logo: null },
  { id: 'efectivo', label: 'Efectivo', note: 'Al recibir o retirar', gateway: null, logo: null },
  { id: 'mercadopago', label: 'Mercado Pago', note: 'Tarjetas de crédito y débito', gateway: 'mercadopago', logo: '/payments/mercadopago.svg' },
  { id: 'mercadocredito', label: 'Mercado Crédito', note: 'Cuotas sin tarjeta · sujeto a aprobación', gateway: 'mercadopago', logo: '/payments/mercadocredito.svg' },
  { id: 'openpay', label: 'Openpay', note: 'Tarjetas de crédito y débito · promos BBVA', gateway: 'openpay', logo: '/payments/openpay.svg' },
  { id: 'sipago', label: 'SiPago', note: 'Tarjetas de crédito y débito', gateway: 'sipago', logo: '/payments/sipago.svg' },
]

export const PROMOS = [
  {
    id: 'mp-tdc-cuotas', gateway: 'mercadopago', gatewayName: 'Mercado Pago',
    bank: null, bankName: null, cards: 'Tarjeta de crédito Mercado Pago',
    title: '2 cuotas sin interés desde $50.000 · 3 cuotas desde $150.000',
    detail: 'Según comercio y canal de pago. El beneficio se aplica en el checkout de Mercado Pago.',
    desde: '2026-01-01', hasta: '2026-12-31',
    link: 'https://promociones.mercadopago.com.ar/',
  },
  {
    id: 'mp-credito', gateway: 'mercadopago', gatewayName: 'Mercado Pago',
    bank: null, bankName: null, cards: 'Mercado Crédito',
    title: 'Cuotas sin tarjeta (hasta 12 cuotas fijas)',
    detail: 'Sin costo de mantenimiento. Solo costo financiero, sujeto a aprobación de crédito.',
    desde: '2026-01-01', hasta: '2026-12-31',
    link: 'https://www.mercadolibre.com.ar/mercado-credito',
  },
  {
    id: 'openpay-bbva-reintegro', gateway: 'openpay', gatewayName: 'Openpay',
    bank: 'bbva', bankName: 'BBVA', cards: 'Visa / Mastercard BBVA',
    title: '30% de reintegro los martes',
    detail: 'Un pago. Tope $12.000 por cuenta por mes. Vigente hasta 31/12/2026.',
    desde: '2026-07-01', hasta: '2026-12-31',
    link: 'https://www.openpayargentina.com.ar/beneficios/promociones',
  },
  {
    id: 'openpay-bbva-cuotas', gateway: 'openpay', gatewayName: 'Openpay',
    bank: 'bbva', bankName: 'BBVA', cards: 'Visa / Mastercard BBVA',
    title: '3 cuotas sin interés (viernes y sábados) · 6 cuotas en rubros seleccionados',
    detail: 'Según rubro del comercio y campaña activa. Ver términos y condiciones.',
    desde: '2026-07-01', hasta: '2026-12-31',
    link: 'https://www.openpayargentina.com.ar/beneficios/promociones',
  },
  {
    id: 'sipago-credicoop', gateway: 'sipago', gatewayName: 'SiPago',
    bank: 'credicoop', bankName: 'Banco Credicoop', cards: 'Cabal Credicoop',
    title: '3 cuotas sin interés todos los días',
    detail: 'Costo financiero cubierto por SiPago. Vigente 01/09/2026 al 31/12/2026.',
    desde: '2026-09-01', hasta: '2026-12-31',
    link: 'https://www.sipago.coop/beneficios',
  },
  {
    id: 'sipago-green-friday', gateway: 'sipago', gatewayName: 'SiPago',
    bank: null, bankName: 'Todos los bancos', cards: 'Cabal, Visa y Mastercard',
    title: 'Green Friday 27/11: 3 y 6 cuotas sin interés',
    detail: 'Compras online con Sipago. No acumulable con otros beneficios.',
    desde: '2026-11-27', hasta: '2026-11-27',
    link: 'https://www.sipago.coop/legales-beneficios',
  },
]

/** Devuelve las promos vigentes en una fecha (YYYY-MM-DD comparado como string). */
export function promosVigentes(fecha = new Date()) {
  const dia = fecha.toISOString().slice(0, 10)
  return PROMOS.filter(p => dia >= p.desde && dia <= p.hasta)
}
