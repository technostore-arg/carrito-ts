/**
 * CartContext — carrito optimista, cupones instantáneos, envío dinámico.
 * @typedef {import('../config/store.js').PaymentMethod} PaymentMethod
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { COUPONS, FREE_SHIPPING_THRESHOLD, SHIPPING_COST, shippingCost } from '../config/store.js'
import { priceForMethod } from '../utils/pricing.js'

export { FREE_SHIPPING_THRESHOLD, SHIPPING_COST }

const CartContext = createContext(null)
const STORAGE_KEY = 'technostore_cart'
const PREFS_KEY = 'technostore_cart_prefs'

/** @param {string} code */
function findCoupon(code) {
  const key = String(code || '').trim().toUpperCase()
  return COUPONS[key] ? { code: key, ...COUPONS[key] } : null
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] }
  })
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {} } catch { return {} }
  })
  const [toast, setToast] = useState(null)

  const metodoPago = prefs.metodoPago || 'transferencia'
  const entrega = prefs.entrega || { tipo: 'envio', cp: '' }
  const cupon = prefs.cupon || null
  const [couponError, setCouponError] = useState(null)

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }, [items])
  useEffect(() => { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) }, [prefs])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  /** @param {object} product */
  const addToCart = product => {
    setItems(prev => {
      const sku = String(product.sku || product.id)
      const found = prev.find(i => String(i.sku) === sku)
      const maxQty = Number(product.stock) > 0 ? Number(product.stock) : 99
      if (found) {
        return prev.map(i => String(i.sku) === sku ? { ...i, qty: Math.min(i.qty + 1, maxQty) } : i)
      }
      return [...prev, {
        sku,
        nombre: product.nombre || product.name || '',
        categoria: product.categoria || '',
        precio: Number(product.precio_transferencia ?? product.precio) || 0,
        precio_transferencia: Number(product.precio_transferencia ?? product.precio) || 0,
        precio_mercadopago: Number(product.precio_mercadopago ?? product.precio) || 0,
        precio_lista: product.precio_lista ?? null,
        stock: Number(product.stock) || 0,
        stock_source: product.stock_source || 'local',
        imagen: product.imagenes?.[0] || product.image || null,
        qty: 1,
      }]
    })
    setToast(`${product.nombre || product.name} agregado al carrito`)
  }

  const removeFromCart = sku => setItems(prev => prev.filter(i => String(i.sku) !== String(sku)))
  const setQty = (sku, qty) => setItems(prev => prev.map(i => {
    if (String(i.sku) !== String(sku)) return i
    const max = Number(i.stock) > 0 ? Number(i.stock) : 99
    return { ...i, qty: Math.max(1, Math.min(max, Math.round(qty) || 1)) }
  }))
  const updateQty = (sku, delta) => {
    const item = items.find(i => String(i.sku) === String(sku))
    if (item) setQty(sku, item.qty + delta)
  }
  const clearCart = () => { setItems([]); setCouponError(null) }

  const setMetodoPago = mp => setPrefs(p => ({ ...p, metodoPago: mp }))
  const setEntrega = entrega => setPrefs(p => ({ ...p, entrega }))
  const setCupon = cupon => { setCouponError(null); setPrefs(p => ({ ...p, cupon })) }

  /** Aplicación optimista: no hay round-trip al servidor. */
  const applyCoupon = code => {
    const found = findCoupon(code)
    if (!found) { setCouponError('Cupón no válido. Probá con BIENVENIDA10.'); return false }
    setCupon(found)
    setToast(`Cupón ${found.code} aplicado`)
    return true
  }
  const removeCoupon = () => setCupon(null)

  const count = useMemo(() => items.reduce((s, i) => s + (Number(i.qty) || 0), 0), [items])
  const getPrice = item => priceForMethod(item, metodoPago)
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + getPrice(i) * (Number(i.qty) || 0), 0),
    [items, metodoPago]
  )

  const descuento = useMemo(() => {
    if (!cupon) return 0
    if (cupon.tipo === 'porcentaje') return Math.round(subtotal * cupon.valor) / 100
    if (cupon.tipo === 'fijo') return Math.min(cupon.valor, subtotal)
    return 0
  }, [cupon, subtotal])
  const subtotalFinal = Math.max(0, subtotal - descuento)
  const shipping = useMemo(() => {
    if (!items.length || entrega.tipo === 'retiro' || cupon?.tipo === 'envio') return 0
    return shippingCost(entrega.cp, subtotalFinal)
  }, [items.length, entrega.tipo, entrega.cp, cupon, subtotalFinal])
  const total = subtotalFinal + shipping
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalFinal)
  const freeShippingProgress = Math.min(100, Math.round((subtotalFinal / FREE_SHIPPING_THRESHOLD) * 100))

  return (
    <CartContext.Provider value={{
      items, detailed: items, count, subtotal, subtotalFinal, descuento, shipping, total,
      freeShippingRemaining, freeShippingProgress, freeUnlocked: freeShippingRemaining === 0,
      metodoPago, setMetodoPago, entrega, setEntrega, cupon, couponError, applyCoupon, removeCoupon,
      addToCart, removeFromCart, updateQty, setQty, clearCart, toast, getPrice,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
