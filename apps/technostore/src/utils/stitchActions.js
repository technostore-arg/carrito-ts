/** Normaliza los data-path de las propuestas Stitch (desktop y mobile usan nombres distintos). */
const GROUPS = {
  cart: ['carrito-de-compras', 'carrito', 'active-cart', 'cart-review', 'shopping-cart'],
  catalog: ['catalogo-de-productos', 'catalogo', 'explore-catalog', 'ofertas', 'inicio', 'home-technostore-desktop-tecnologia-y-confianza', 'product-search', 'catalog'],
  account: ['mis-pedidos', 'order-history', 'mi-cuenta-y-garantias', 'iniciar-sesion', 'registro-de-usuario'],
  advisory: ['asesoramiento', 'asesoramiento-pc', 'solicitar-asesoramiento', 'armado-de-pc'],
  rma: ['rma', 'garantia-rma', 'garantia'],
  checkout: ['checkout-envio', 'checkout-pago', 'checkout-confirmar', 'checkout-carrito', 'finalizar-compra', 'checkout', 'pago'],
  security: ['garantias-y-seguridad', 'data-security', 'soporte-garantias', 'security-center'],
  payments: ['promociones-bancarias', 'ofertas-y-bancos', 'payment-method'],
  shipping: ['shipping-address'],
  tracking: ['live-tracking', 'modify-order', 'download-invoice', 'help-center'],
}

export function resolveStitchAction(path = '') {
  const key = String(path || '').toLowerCase()
  // Los pasos del checkout son distintos entre sí: preservar el path exacto.
  if (/^checkout-/.test(key)) return key
  for (const [action, paths] of Object.entries(GROUPS)) {
    if (paths.includes(key)) return action
  }
  return null
}
