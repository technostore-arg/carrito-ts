/**
 * server/hub/orderService.js — Órdenes web con precios calculados en servidor.
 * Nunca confía en el total ni en los precios enviados por el cliente.
 */
import { randomBytes } from 'node:crypto'
import { computeQuote } from './pricingEngine.js'
import { COUPONS, shippingCost, FREE_SHIPPING_THRESHOLD } from '../../apps/technostore/src/config/store.js'

/** Descuento del cupón sobre el subtotal real. */
export function couponDiscount(code, subtotal) {
  const c = COUPONS[String(code || '').trim().toUpperCase()]
  if (!c) return 0
  if (c.tipo === 'porcentaje') return Math.round(subtotal * c.valor) / 100
  if (c.tipo === 'fijo') return Math.min(c.valor, subtotal)
  return 0
}

/**
 * @param {{repo:object, customer:object, items:object[], paymentMethod?:string, couponCode?:string}} deps
 */
export async function placeWebOrder({ repo, customer = {}, items = [], paymentMethod = 'transferencia', couponCode = null } = {}) {
  if (!customer.name || !customer.email) throw new Error('Faltan datos del cliente')
  if (!Array.isArray(items) || !items.length) throw new Error('El carrito está vacío')

  const authoritative = []
  let subtotal = 0
  for (const requested of items) {
    const sku = String(requested.id || requested.sku || '')
    const qty = Math.max(1, Math.floor(Number(requested.qty) || 1))
    const input = await repo.findMasterBySkuOrEan(sku)
    if (!input) throw new Error(`Producto ${sku} no disponible`)
    const quote = computeQuote(input)
    if (quote.quarantined || quote.price_transfer == null) throw new Error(`Producto ${sku} en revisión`)
    if (quote.stock < qty) throw new Error(`Stock insuficiente para ${sku}`)
    const unit = paymentMethod === 'tarjeta' ? (quote.price_list || quote.price_transfer) : quote.price_transfer
    subtotal += unit * qty
    authoritative.push({
      sku,
      masterProductId: input.master_product.id,
      nombre: input.master_product.title,
      qty,
      unitPrice: unit,
      costArs: quote.cost_ars || 0,
      stockSource: quote.stock_source || 'local',
    })
  }

  const discount = couponDiscount(couponCode, subtotal)
  const subtotalFinal = Math.max(0, subtotal - discount)
  const retiro = String(customer.tipoEntrega || 'envio') === 'retiro'
  const shipping = retiro ? 0 : shippingCost(String(customer.cp || ''), subtotalFinal)
  const total = subtotalFinal + shipping
  const code = `TS-${randomBytes(3).toString('hex').toUpperCase()}`

  await repo.createHubOrder({
    code, customer, items: authoritative, subtotal, discount, shipping, total, paymentMethod,
  })

  const supplierOrders = []
  for (const item of authoritative) {
    const movement = await repo.reserveStock({
      masterProductId: item.masterProductId,
      quantity: item.qty,
      preferredSource: item.stockSource,
    })
    if (movement.fulfillmentSource === 'supplier') {
      const mlOrderId = `WEB-${code}-${item.sku}`
      await repo.upsertMlOrder({
        mlOrderId,
        masterProductId: item.masterProductId,
        quantity: item.qty,
        totalAmount: item.unitPrice * item.qty,
        fulfillmentSource: 'supplier',
        supplierOrderStatus: 'pending_supplier_order',
        payloadJson: { source: 'web', code, sku: item.sku, cost_ars: item.costArs },
      })
      supplierOrders.push(mlOrderId)
    }
  }

  return {
    ok: true, code, subtotal, discount, shipping, total,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    items: authoritative.map(i => ({ sku: i.sku, nombre: i.nombre, qty: i.qty, precio: i.unitPrice })),
    supplierOrders,
  }
}
