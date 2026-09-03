import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import productsData from '../data/products.json'

export const FREE_SHIPPING_THRESHOLD = 300000
export const SHIPPING_COST = 15000

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('technova_cart')) || [] } catch { return [] }
  })
  const [toast, setToast] = useState(null)

  useEffect(() => { localStorage.setItem('technova_cart', JSON.stringify(items)) }, [items])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // Soporta tanto productos API (sku) como legacy (id)
  const addToCart = product => {
    const key = product.sku || product.id
    const isSku = !!product.sku
    setItems(prev => {
      const found = prev.find(i => (isSku ? i.sku === key : i.id === key))
      if (found) {
        return prev.map(i => {
          const match = isSku ? i.sku === key : i.id === key
          return match ? { ...i, qty: Math.min(i.qty + 1, product.stock ?? 99) } : i
        })
      }
      if (isSku) return [...prev, { sku: product.sku, nombre: product.nombre, precio: product.precio, stock: product.stock, imagen: product.imagenes?.[0] || null, qty: 1 }]
      return [...prev, { id: product.id, qty: 1 }]
    })
    const name = product.nombre || product.name
    setToast(`${name} agregado`)
  }

  const removeFromCart = key => setItems(prev => prev.filter(i => (i.sku ? i.sku !== key : i.id !== key)))
  const updateQty = (key, delta) => setItems(prev => prev.map(i => {
    const match = i.sku ? i.sku === key : i.id === key
    return match ? { ...i, qty: Math.min(Math.max(1, i.qty + delta), 99) } : i
  }))
  const clearCart = () => setItems([])

  const detailed = useMemo(() => items.map(i => {
    if (i.sku) return { ...i, id: i.sku, name: i.nombre, price: i.precio, emoji: '📦', image: i.imagen }
    const p = productsData.find(p => p.id === i.id)
    return p ? { ...p, qty: i.qty } : null
  }).filter(Boolean), [items])

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])
  const subtotal = useMemo(() => detailed.reduce((s, p) => s + (p.precio ?? p.price ?? 0) * p.qty, 0), [detailed])
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping

  return (
    <CartContext.Provider value={{ items, detailed, count, subtotal, shipping, total, addToCart, removeFromCart, updateQty, clearCart, toast }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
