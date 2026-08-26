import { useEffect, useMemo, useState } from 'react'
import { CartProvider, useCart } from './context/CartContext'
import localProducts from './data/products.json'
import Header from './components/Header'
import Hero from './components/Hero'
import CategoryFilter from './components/CategoryFilter'
import ProductGrid from './components/ProductGrid'
import GpuCompare from './components/GpuCompare'
import ServicesSection from './components/ServicesSection'
import CartDrawer from './components/CartDrawer'
import CheckoutModal from './components/CheckoutModal'
import Footer from './components/Footer'

const CATEGORY_LABELS = {
  todos: 'Todos',
  gpus: 'Placas Gráficas',
  memorias: 'Memorias & Storage',
  workstations: 'Workstations IA',
  accesorios: 'Accesorios',
}

function Store() {
  const { setCartOpen } = useCart()
  const [category, setCategory] = useState('todos')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('destacados')
  const [vram, setVram] = useState('')
  const [framework, setFramework] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [products, setProducts] = useState(null)

  useEffect(() => {
    let alive = true
    fetch('/api/products')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(data => alive && setProducts(data))
      .catch(() => alive && setProducts(localProducts))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('locked', checkoutOpen)
  }, [checkoutOpen])

  const counts = useMemo(() => {
    if (!products) return {}
    return products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1
      return acc
    }, {})
  }, [products])

  const visibleProducts = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    const minVram = vram ? Number(vram) : null
    let list = products.filter(p => category === 'todos' || p.category === category)

    if (minVram && category !== 'workstations') {
      list = list.filter(p => (p.vram ?? 0) >= minVram)
    }
    if (framework) {
      list = list.filter(p => !p.frameworks?.length || p.frameworks.includes(framework))
    }
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.specs.some(s => s.toLowerCase().includes(q)) ||
          p.frameworks?.some(f => f.includes(q)),
      )
    }

    switch (sort) {
      case 'precio-asc':
        return [...list].sort((a, b) => a.price - b.price)
      case 'precio-desc':
        return [...list].sort((a, b) => b.price - a.price)
      case 'rating':
        return [...list].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      default:
        return [...list].sort(
          (a, b) =>
            (b.vram ?? 0) - (a.vram ?? 0) ||
            b.reviews * b.rating - a.reviews * a.rating,
        )
    }
  }, [products, category, search, sort, vram, framework])

  const scrollToCatalog = () => {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Header
        search={search}
        onSearchChange={setSearch}
        onSelectCategory={cat => {
          setCategory(cat)
          scrollToCatalog()
        }}
      />
      <main>
        <Hero onExplore={scrollToCatalog} />
        <section id="catalogo" className="container">
          <div className="section-intro">
            <span className="eyebrow">Catálogo</span>
            <h2>
              Hardware para <span className="grad-text">correr modelos en serio</span>
            </h2>
          </div>
          <CategoryFilter
            active={category}
            labels={CATEGORY_LABELS}
            counts={{ ...counts, todos: products?.length ?? 0 }}
            onChange={setCategory}
            sort={sort}
            onSortChange={setSort}
            vram={vram}
            onVramChange={setVram}
            framework={framework}
            onFrameworkChange={setFramework}
          />
          <ProductGrid
            products={visibleProducts}
            totalLabel={`${visibleProducts.length} producto${visibleProducts.length === 1 ? '' : 's'}`}
            onReset={() => {
              setSearch('')
              setCategory('todos')
              setVram('')
              setFramework('')
            }}
          />
        </section>
        <GpuCompare products={products ?? []} />
        <ServicesSection />
      </main>
      <Footer onSelectCategory={setCategory} />
      <CartDrawer
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
      />
      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
      <Toast />
    </>
  )
}

function Toast() {
  const { toast } = useCart()
  if (!toast) return null
  return (
    <div className="toast" role="status">
      ✅ {toast}
    </div>
  )
}

export default function App() {
  return (
    <CartProvider>
      <Store />
    </CartProvider>
  )
}
