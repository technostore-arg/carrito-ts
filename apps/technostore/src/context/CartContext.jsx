import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const FREE_SHIPPING_THRESHOLD = 300000
export const SHIPPING_COST = 15000

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('technostore_cart')) || [] } catch { return [] }
  })
  const [toast, setToast] = useState(null)
  const [metodoPago, setMetodoPago] = useState('transferencia')

  useEffect(() => { localStorage.setItem('technostore_cart', JSON.stringify(items)) }, [items])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const addToCart = product => {
    setItems(prev => {
      const found = prev.find(i => i.sku === product.sku)
      const maxQty = product.stock ?? 99
      if (found) return prev.map(i => i.sku === product.sku ? { ...i, qty: Math.min(i.qty + 1, maxQty) } : i)
      return [...prev, {
        sku: product.sku,
        nombre: product.nombre,
        precio: product.precio_transferencia,
        precio_transferencia: product.precio_transferencia,
        precio_mercadopago: product.precio_mercadopago,
        stock: product.stock,
        imagen: product.imagenes?.[0] || null,
        qty: 1,
      }]
    })
    setToast(`${product.nombre} agregado`)
  }

  const removeFromCart = sku => setItems(prev => prev.filter(i => i.sku !== sku))
  const updateQty = (sku, delta) => setItems(prev => prev.map(i => i.sku === sku ? { ...i, qty: Math.min(Math.max(1, i.qty + delta), i.stock ?? 99) } : i))
  const clearCart = () => setItems([])

  const detailed = items
  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])

  const getPrice = (item) => {
    if (metodoPago === 'mercadopago') return item.precio_mercadopago || item.precio
    return item.precio_transferencia || item.precio
  }

  const subtotal = useMemo(() => detailed.reduce((s, p) => s + getPrice(p) * p.qty, 0), [detailed, metodoPago])
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping

  return (
    <CartContext.Provider value={{ items, detailed, count, subtotal, shipping, total, addToCart, removeFromCart, updateQty, clearCart, toast, metodoPago, setMetodoPago, getPrice }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
