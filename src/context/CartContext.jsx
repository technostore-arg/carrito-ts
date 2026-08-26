import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import productsData from '../data/products.json'

export const FREE_SHIPPING_THRESHOLD = 300000
export const SHIPPING_COST = 15000

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('technova_cart')) || []
    } catch {
      return []
    }
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    localStorage.setItem('technova_cart', JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const addToCart = product => {
    setItems(prev => {
      const found = prev.find(i => i.id === product.id)
      if (found) {
        return prev.map(i =>
          i.id === product.id ? { ...i, qty: Math.min(i.qty + 1, product.stock) } : i,
        )
      }
      return [...prev, { id: product.id, qty: 1 }]
    })
    setToast(`${product.name} agregado al carrito`)
  }

  const removeFromCart = id => setItems(prev => prev.filter(i => i.id !== id))

  const updateQty = (id, delta) =>
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, qty: Math.min(Math.max(1, i.qty + delta), 99) } : i)),
    )

  const clearCart = () => setItems([])

  const detailed = useMemo(
    () =>
      items
        .map(i => {
          const p = productsData.find(p => p.id === i.id)
          return p ? { ...p, qty: i.qty } : null
        })
        .filter(Boolean),
    [items],
  )

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])
  const subtotal = useMemo(
    () => detailed.reduce((s, p) => s + p.price * p.qty, 0),
    [detailed],
  )

  const shipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shipping

  return (
    <CartContext.Provider
      value={{
        items,
        detailed,
        count,
        subtotal,
        shipping,
        total,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        cartOpen,
        setCartOpen,
        toast,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
