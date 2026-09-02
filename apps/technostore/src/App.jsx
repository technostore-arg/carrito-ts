import { useMemo, useState, useEffect } from "react"
import { motion } from "framer-motion"
import Header from "./components/Header"
import Hero from "./components/Hero"
import FilterBar, { rangoMatch, ORDENES } from "./components/FilterBar"
import ProductGrid from "./components/ProductGrid"
import ProductDetail from "./components/ProductDetail"
import Footer from "./components/Footer"
import { mockProducts as fallbackProducts } from "./data/mockProducts"

function getBrand(p) {
  // Preferir p.marca si existe (viene del API), fallback a heurística por nombre
  const m = (p.marca || "").toLowerCase()
  if (m === "samsung") return "Samsung"
  if (m === "apple") return "Apple"
  if (p.marca && p.marca !== "technostore" && p.marca !== "futurohard") {
    return p.marca.charAt(0).toUpperCase() + p.marca.slice(1)
  }
  const n = p.nombre || ""
  const up = n.toUpperCase()
  if (up.includes("SAMSUNG")) return "Samsung"
  if (up.includes("XIAOMI") || up.includes(" REDMI") || up.startsWith("REDMI") || up.includes(" POCO") || up.startsWith("POCO")) return "Xiaomi"
  if (up.includes("IPHONE") || up.includes("AIRPODS") || up.includes("MACBOOK")) return "Apple"
  if (up.includes("GOOGLE") || up.includes("PIXEL")) return "Google"
  if (up.includes("MOTOROLA") || up.includes(" MOTO ")) return "Motorola"
  if (up.startsWith("DELL")) return "Dell"
  if (up.startsWith("LENOVO")) return "Lenovo"
  if (up.startsWith("ASUS")) return "ASUS"
  if (up.startsWith("PC GAMER") || up.startsWith("MINI PC")) return "Armados"
  if (up.startsWith("TECLADO") || up.startsWith("SSD")) return "Accesorios"
  return "Otros"
}

export default function App() {
  const [categoria, setCategoria] = useState("todos")
  const [marca, setMarca] = useState("todos")
  const [rango, setRango] = useState("todos")
  const [q, setQ] = useState("")
  const [orden, setOrden] = useState("relevancia")
  const [products, setProducts] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (Array.isArray(data)) setProducts(data) })
      .catch(() => setProducts([]))
  }, [])

  // URL → estado inicial
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const c = sp.get("cat"); if (c) setCategoria(c)
    const m = sp.get("marca"); if (m) setMarca(m)
    const r = sp.get("rango"); if (r) setRango(r)
    const qq = sp.get("q"); if (qq) setQ(qq)
    const o = sp.get("orden"); if (o && ORDENES.some(x => x.id === o)) setOrden(o)
  }, [])
  // estado → URL
  useEffect(() => {
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (marca !== "todos") sp.set("marca", marca)
    if (rango !== "todos") sp.set("rango", rango)
    if (q.trim()) sp.set("q", q.trim())
    if (orden !== "relevancia") sp.set("orden", orden)
    const qs = sp.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", url)
  }, [categoria, marca, rango, q, orden])

  // ESC cierra modal
  useEffect(() => {
    const h = e => { if (e.key === "Escape") setSelectedProduct(null) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  // null = cargando, [] = catálogo vacío
  const source = products === null ? null : products
  const allProducts = source ?? []

  const marcasDisponibles = useMemo(() => {
    if (source === null) return []
    const set = new Set(allProducts.map(getBrand))
    return Array.from(set).sort()
  }, [allProducts, source])

  const counts = useMemo(() => {
    const c = { todos: allProducts.length }
    for (const p of allProducts) c[p.categoria] = (c[p.categoria] || 0) + 1
    return c
  }, [allProducts])

  const visibles = useMemo(() => {
    if (source === null) return []
    const query = q.trim().toLowerCase()
    let out = allProducts.filter(p => {
      if (categoria !== "todos" && p.categoria !== categoria) return false
      if (marca !== "todos" && getBrand(p) !== marca) return false
      if (p.tipo_venta === "directa" && !rangoMatch(p.precio, rango)) return false
      if (p.tipo_venta === "encargo" && rango !== "todos") {
        if (rango !== "todos") return false
      }
      if (query) {
        const hay =
          p.nombre.toLowerCase().includes(query) ||
          p.descripcion.toLowerCase().includes(query) ||
          Object.values(p.especificaciones || {}).some(v => String(v).toLowerCase().includes(query))
        if (!hay) return false
      }
      return true
    })
    if (orden === "precio-asc") out = [...out].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
    else if (orden === "precio-desc") out = [...out].sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0))
    else if (orden === "nombre-asc") out = [...out].sort((a, b) => a.nombre.localeCompare(b.nombre))
    return out
  }, [categoria, marca, rango, q, orden, source, allProducts])

  const hasFiltros = categoria !== "todos" || marca !== "todos" || rango !== "todos" || q.trim() !== "" || orden !== "relevancia"
  const limpiarFiltros = () => { setCategoria("todos"); setMarca("todos"); setRango("todos"); setQ(""); setOrden("relevancia") }

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
      <Header
        search={q}
        onSearchChange={setQ}
        activeCategory={categoria}
        onSelectCategory={c => {
          setCategoria(c)
          scrollToCatalog()
        }}
      />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}>
        <Hero onExplore={scrollToCatalog} />
        <section id="catalogo" className="container">
          {(q.trim() || hasFiltros) && (
            <nav className="breadcrumbs" aria-label="Filtros activos">
              <button onClick={() => { setCategoria("todos"); scrollToCatalog() }}>Catálogo</button>
              {categoria !== "todos" && <><span>›</span><button onClick={() => setCategoria("todos")}>{categoria}</button></>}
              {marca !== "todos" && <><span>›</span><button onClick={() => setMarca("todos")}>{marca}</button></>}
              {q.trim() && <><span>›</span><span className="crumb-q">“{q.trim()}”</span></>}
            </nav>
          )}
          <div className="section-intro">
            <span className="eyebrow">Catálogo TechnoStore</span>
            <h2>
              Todo lo que necesitás, <span style={{ color: "var(--blue)" }}>a un clic</span>
            </h2>
            <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
              Celulares, notebooks, computadoras y accesorios con fotos grandes, specs claras y
              filtros que realmente ayudan. Probado en mobile primero.
            </p>
          </div>

          <div style={{ marginTop: 24 }}>
            <FilterBar
              categoria={categoria}
              marca={marca}
              rango={rango}
              orden={orden}
              onCategoria={c => { setCategoria(c); scrollToCatalog() }}
              onMarca={setMarca}
              onRango={setRango}
              onOrden={setOrden}
              marcasDisponibles={marcasDisponibles}
              counts={counts}
              totalVisibles={visibles.length}
              totalAll={allProducts.length}
              hasFiltros={hasFiltros}
              onLimpiar={limpiarFiltros}
            />
          </div>

          <ProductGrid
            products={source === null ? null : visibles}
            totalLabel={`${(source === null ? 0 : visibles.length)} producto${(source === null ? 0 : visibles.length) === 1 ? "" : "s"}`}
            onReset={() => {
              setCategoria("todos")
              setMarca("todos")
              setRango("todos")
              setQ("")
            }}
            onDetail={setSelectedProduct}
          />
        </section>
      </motion.main>
      <Footer onSelectCategory={setCategoria} />
      {selectedProduct && <ProductDetail producto={selectedProduct} onClose={() => setSelectedProduct(null)} />}
    </motion.div>
  )
}
