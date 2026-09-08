import { useMemo, useState, useEffect } from "react"
import Header from "./components/Header"
import Hero from "./components/Hero"
import FilterBar, { rangoMatch, ORDENES, isHardware, CATEGORIAS } from "./components/FilterBar"
import { matchCpu, matchRam, matchSsd, specOptions, CPU_LABELS, fmtCap } from "./utils/specs"
import ProductGrid from "./components/ProductGrid"
import ProductDetail from "./components/ProductDetail"
import CartPage from "./components/CartPage"
import Footer from "./components/Footer"
import WhatsAppFloat from "./components/WhatsAppFloat"
import { useCart } from "./context/CartContext"

function getBrand(p) {
  const m = (p.marca || "").toLowerCase()
  if (m === "samsung") return "Samsung"
  if (m === "apple") return "Apple"
  if (p.marca && p.marca !== "technostore" && p.marca !== "futurohard") return p.marca.charAt(0).toUpperCase() + p.marca.slice(1)
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
  if (up.startsWith("HP") || up.includes(" OMNIBOOK") || up.includes(" VICTUS") || up.includes(" PROBOOK") || up.includes(" ENVY") || up.includes(" OMEN") || up.includes(" SPECTRE")) return "HP"
  if (up.startsWith("MSI")) return "MSI"
  if (up.startsWith("ACER")) return "Acer"
  if (up.startsWith("MICROSOFT")) return "Microsoft"
  if (up.startsWith("SAMSUNG")) return "Samsung"
  if (up.startsWith("PC GAMER") || up.startsWith("MINI PC")) return "Armados"
  if (up.startsWith("TECLADO") || up.startsWith("SSD")) return "Accesorios"
  return "Otros"
}

export default function App() {
  const { addToCart, count: cartCount, toast } = useCart()
  const base = import.meta.env.BASE_URL || "/"
  const [page, setPage] = useState(() => (typeof window !== "undefined" && window.location.pathname.includes("carrito") ? "cart" : "home"))
  const [categoria, setCategoria] = useState("todos")
  const [marca, setMarca] = useState("todos")
  const [rango, setRango] = useState("todos")
  const [q, setQ] = useState("")
  const [orden, setOrden] = useState("relevancia")
  const [cpu, setCpu] = useState("")
  const [ram, setRam] = useState("")
  const [ssd, setSsd] = useState("")
  const [products, setProducts] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    fetch("/api/products").then(r => r.ok ? r.json() : Promise.reject()).then(data => { if (Array.isArray(data)) setProducts(data) }).catch(() => setProducts([]))
  }, [])

  // page navigation via history (base-aware)
  useEffect(() => {
    const onPop = () => setPage(window.location.pathname.includes("carrito") ? "cart" : "home")
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const goCart = () => { window.history.pushState(null, "", `${base}carrito`); setPage("cart"); window.scrollTo(0, 0) }
  const goHome = () => { window.history.pushState(null, "", base); setPage("home"); setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 80) }

  // URL → estado inicial (solo si estamos en home)
  useEffect(() => {
    if (page === "cart") return
    const sp = new URLSearchParams(window.location.search)
    const c = sp.get("cat"); if (c) setCategoria(c)
    const m = sp.get("marca"); if (m) setMarca(m)
    const r = sp.get("rango"); if (r) setRango(r)
    const qq = sp.get("q"); if (qq) setQ(qq)
    const o = sp.get("orden"); if (o && ORDENES.some(x => x.id === o)) setOrden(o)
    const cu = sp.get("cpu"); if (cu) setCpu(cu)
    const ra = sp.get("ram"); if (ra) setRam(ra)
    const sd = sp.get("ssd"); if (sd) setSsd(sd)
  }, []) // eslint-disable-line

  // estado → URL (solo en home)
  useEffect(() => {
    if (page !== "home") return
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (marca !== "todos") sp.set("marca", marca)
    if (rango !== "todos") sp.set("rango", rango)
    if (q.trim()) sp.set("q", q.trim())
    if (orden !== "relevancia") sp.set("orden", orden)
    if (cpu) sp.set("cpu", cpu)
    if (ram) sp.set("ram", ram)
    if (ssd) sp.set("ssd", ssd)
    const qs = sp.toString()
    const url = qs ? `${base}?${qs}` : base
    window.history.replaceState(null, "", url)
  }, [categoria, marca, rango, q, orden, cpu, ram, ssd, page])

  useEffect(() => {
    const h = e => { if (e.key === "Escape") setSelectedProduct(null) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const source = products === null ? null : products
  const allProducts = source ?? []
  const marcasDisponibles = useMemo(() => { if (source === null) return []; return Array.from(new Set(allProducts.map(getBrand))).sort() }, [allProducts, source])

  // Auto-curar filtros inválidos (ej. marca guardada en URL que ya no existe en el catálogo)
  const validCatIds = useMemo(() => new Set(CATEGORIAS.map(c => c.id)), [])
  useEffect(() => {
    if (source === null) return
    if (marca !== "todos" && !marcasDisponibles.includes(marca)) setMarca("todos")
    if (!validCatIds.has(categoria)) setCategoria("todos")
  }, [source, marcasDisponibles, marca, categoria, validCatIds])
  const counts = useMemo(() => { const c = { todos: allProducts.length, hardware: 0 }; for (const p of allProducts) { c[p.categoria] = (c[p.categoria] || 0) + 1; if (isHardware(p.categoria)) c.hardware++ } return c }, [allProducts])
  const specOpts = useMemo(() => specOptions(allProducts), [allProducts])
  const visibles = useMemo(() => {
    if (source === null) return []
    const query = q.trim().toLowerCase()
    let out = allProducts.filter(p => {
      if (categoria === "hardware" ? !isHardware(p.categoria) : (categoria !== "todos" && p.categoria !== categoria)) return false
      if (marca !== "todos" && getBrand(p) !== marca) return false
      if (p.tipo_venta === "directa" && !rangoMatch(p.precio, rango)) return false
      if (p.tipo_venta === "encargo" && rango !== "todos") return false
      if (!matchCpu(p, cpu)) return false
      if (!matchRam(p, ram)) return false
      if (!matchSsd(p, ssd)) return false
      if (query) { const hay = p.nombre.toLowerCase().includes(query) || p.descripcion.toLowerCase().includes(query) || Object.values(p.especificaciones || {}).some(v => String(v).toLowerCase().includes(query)); if (!hay) return false }
      return true
    })
    if (orden === "precio-asc") out = [...out].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
    else if (orden === "precio-desc") out = [...out].sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0))
    else if (orden === "nombre-asc") out = [...out].sort((a, b) => a.nombre.localeCompare(b.nombre))
    return out
  }, [categoria, marca, rango, q, orden, cpu, ram, ssd, source, allProducts])

  const hasFiltros = categoria !== "todos" || marca !== "todos" || rango !== "todos" || q.trim() !== "" || orden !== "relevancia" || cpu !== "" || ram !== "" || ssd !== ""
  const limpiarFiltros = () => { setCategoria("todos"); setMarca("todos"); setRango("todos"); setQ(""); setOrden("relevancia"); setCpu(""); setRam(""); setSsd("") }
  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })

  const handleSelectCategory = c => {
    if (page === "cart") {
      setCategoria(c)
      window.history.pushState(null, "", base)
      setPage("home")
      setTimeout(scrollToCatalog, 100)
    } else {
      setCategoria(c)
      scrollToCatalog()
    }
  }

  return (
    <div>
      <Header
        search={q}
        onSearchChange={setQ}
        activeCategory={page === "cart" ? "" : categoria}
        cartCount={cartCount}
        onCart={goCart}
        onSelectCategory={handleSelectCategory}
      />

      {page === "cart" ? (
        <CartPage onBack={goHome} />
      ) : (
        <main>
          <Hero onExplore={scrollToCatalog} />
          <section id="catalogo" className="container">
            {(q.trim() || hasFiltros) && (
              <nav className="breadcrumbs" aria-label="Filtros activos">
                <button onClick={() => { setCategoria("todos"); scrollToCatalog() }}>Catálogo</button>
                {categoria !== "todos" && <><span>›</span><button onClick={() => setCategoria("todos")}>{(CATEGORIAS.find(c => c.id === categoria)?.label) || categoria}</button></>}
                {marca !== "todos" && <><span>›</span><button onClick={() => setMarca("todos")}>{marca}</button></>}
                {cpu && <><span>›</span><button onClick={() => setCpu("")}>{CPU_LABELS[cpu] || cpu}</button></>}
                {ram && <><span>›</span><button onClick={() => setRam("")}>{fmtCap(Number(ram))} RAM</button></>}
                {ssd && <><span>›</span><button onClick={() => setSsd("")}>{fmtCap(Number(ssd))} SSD</button></>}
                {q.trim() && <><span>›</span><span className="crumb-q">“{q.trim()}”</span></>}
              </nav>
            )}
            <div className="section-intro">
              <span className="eyebrow">Catálogo TechnoStore</span>
              <h2>Todo lo que necesitás, <em>a un clic</em></h2>
              <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>Celulares, notebooks, computadoras y accesorios con fotos reales, precios claros y filtros que ayudan.</p>
            </div>
            <div style={{ marginTop: 20 }}>
              <FilterBar
                categoria={categoria} marca={marca} rango={rango} orden={orden} cpu={cpu} ram={ram} ssd={ssd}
                onCategoria={c => { setCategoria(c); scrollToCatalog() }}
                onMarca={setMarca} onRango={setRango} onOrden={setOrden} onCpu={setCpu} onRam={setRam} onSsd={setSsd}
                marcasDisponibles={marcasDisponibles} cpuOptions={specOpts.cpus} ramOptions={specOpts.rams} ssdOptions={specOpts.ssds} counts={counts}
                totalVisibles={visibles.length} totalAll={allProducts.length}
                hasFiltros={hasFiltros} onLimpiar={limpiarFiltros}
              />
            </div>
            <ProductGrid
              products={source === null ? null : visibles}
              totalLabel={`${(source === null ? 0 : visibles.length)} producto${(source === null ? 0 : visibles.length) === 1 ? "" : "s"}`}
              onReset={() => { setCategoria("todos"); setMarca("todos"); setRango("todos"); setQ(""); setCpu(""); setRam(""); setSsd("") }}
              onDetail={setSelectedProduct} onAddToCart={addToCart}
            />
          </section>
        </main>
      )}

      <Footer onSelectCategory={handleSelectCategory} />
      <WhatsAppFloat />
      {selectedProduct && <ProductDetail producto={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
