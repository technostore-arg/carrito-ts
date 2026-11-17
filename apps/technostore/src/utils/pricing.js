/**
 * Utilidades de pricing: precios duales, ahorro y cuotas.
 * @typedef {import('../config/store.js').PaymentMethod} PaymentMethod
 */
import { ars } from '../utils/format.js'
import { INSTALLMENTS } from '../config/store.js'

/**
 * Precio "de lista / tarjeta". Si el producto no lo trae, se deriva del
 * precio de Mercado Pago (regla histórica ×1.16 del proveedor).
 * @param {{precio_lista?:number, precio_mercadopago?:number, precio?:number, precio_transferencia?:number}} p
 */
export function listaPrice(p) {
  const lista = Number(p?.precio_lista)
  if (lista > 0) return lista
  const mp = Number(p?.precio_mercadopago)
  if (mp > 0) return mp
  return Number(p?.precio_transferencia ?? p?.precio) || 0
}

/**
 * @param {{precio_lista?:number, precio_mercadopago?:number, precio?:number, precio_transferencia?:number}} p
 * @returns {{lista:number, transferencia:number, ahorro:number, porcentaje:number}}
 */
export function priceInfo(p) {
  const lista = listaPrice(p)
  const transferencia = Number(p?.precio_transferencia ?? p?.precio) || 0
  const ahorro = Math.max(0, lista - transferencia)
  const porcentaje = lista > 0 && ahorro > 0 ? Math.round((ahorro / lista) * 100) : 0
  return { lista, transferencia, ahorro, porcentaje }
}

/** @param {number} lista @param {number} cuotas */
export function installment(lista, cuotas) {
  const valor = Number(lista) || 0
  return valor > 0 ? valor / cuotas : 0
}

/**
 * Texto listo para mostrar en la tarjeta.
 * @param {{precio_lista?:number, precio_mercadopago?:number, precio?:number, precio_transferencia?:number}} p
 */
export function installmentsLabel(p) {
  const { lista } = priceInfo(p)
  if (lista < 60000) return ''
  return `${INSTALLMENTS[0]} cuotas sin interés de ${ars(installment(lista, INSTALLMENTS[0]))}`
}

/**
 * Precio según método de pago (el carrito usa la misma función).
 * @param {object} item
 * @param {PaymentMethod} metodo
 */
export function priceForMethod(item, metodo) {
  if (metodo === 'tarjeta') return Number(item?.precio_lista || item?.precio_mercadopago || item?.precio_transferencia || item?.precio) || 0
  if (metodo === 'mercadopago') return Number(item?.precio_mercadopago || item?.precio_transferencia || item?.precio) || 0
  return Number(item?.precio_transferencia ?? item?.precio) || 0
}
