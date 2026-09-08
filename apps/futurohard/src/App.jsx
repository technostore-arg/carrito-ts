import { useMemo, useState, useEffect } from "react"
import Header from "./components/Header"
import Hero from "./components/Hero"
import ProductGrid from "./components/ProductGrid"
import ProductDetail from "./components/ProductDetail"
import ServicesSection from "./components/ServicesSection"
import CartPage from "./components/CartPage"
import Footer from "./components/Footer"
import WhatsAppFloat from "./components/WhatsAppFloat"
import { useCart } from "./context/CartContext"
import { matchCpu, matchRam, matchSsd, specOptions, fmtCap } from "./utils/specs"

const CATS = [
  { id: "todos", label: "Todos" },
  { id: "gpus", label: "GPUs" },
  { id: "memorias", label: "RAM / SSD" },
  { id: "workstations", label: "Workstations" },
  { id: "notebooks", label: "Notebooks" },
]

export default function App() {
  const { addToCart, count: cartCount, toast } = useCart()
  const base = import.meta.env.BASE_URL || "/"
  const [page, setPage] = useState(() => (typeof window !== "undefined" && window.location.pathname.includes("carrito") ? "cart" : "home"))
  const [categoria, setCategoria] = useState("todos")
  const [q, setQ] = useState("")
  const [cpu, setCpu] = useState("")
  const [ram, setRam] = useState("")
  const [ssd, setSsd] = useState("")
  const [products, setProducts] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    fetch("/api/products").then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (Array.isArray(data)) {
        const fhOnly = data.filter(p => {
          const marca = (p.marca || "").toLowerCase()
          const cat = (p.categoria || "").toLowerCase()
          if (marca === "futurohard") return true
          if (marca === "technostore") return false
          return ["gpus", "memorias", "workstations", "accesorios"].includes(cat) && cat !== "celulares"
        })
        setProducts(fhOnly)
      }
    }).catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    const onPop = () => setPage(window.location.pathname.includes("carrito") ? "cart" : "home")
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  const goCart = () => { window.history.pushState(null, "", `${base}carrito`); setPage("cart"); window.scrollTo(0, 0) }
  const goHome = () => { window.history.pushState(null, "", base); setPage("home"); setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }), 80) }

  useEffect(() => {
    if (page === "cart") return
    const sp = new URLSearchParams(window.location.search)
    const c = sp.get("cat"); if (c) setCategoria(c)
    const qq = sp.get("q"); if (qq) setQ(qq)
  }, []) // eslint-disable-line
  useEffect(() => {
    if (page !== "home") return
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (q.trim()) sp.set("q", q.trim())
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `${base}?${qs}` : base)
  }, [categoria, q, page])
  useEffect(() => {
    const h = e => { if (e.key === "Escape") setSelectedProduct(null) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const source = products === null ? null : products
  const allProducts = source ?? []
  const counts = useMemo(() => { const c = { todos: allProducts.length }; for (const p of allProducts) c[p.categoria] = (c[p.categoria] || 0) + 1; return c }, [allProducts])
  const specOpts = useMemo(() => specOptions(allProducts), [allProducts])
  const visibles = useMemo(() => {
    if (source === null) return []
    const query = q.trim().toLowerCase()
    return allProducts.filter(p => {
      if (categoria !== "todos" && p.categoria !== categoria) return false
      if (!matchCpu(p, cpu)) return false
      if (!matchRam(p, ram)) return false
      if (!matchSsd(p, ssd)) return false
      if (query) { const hay = p.nombre.toLowerCase().includes(query) || p.descripcion.toLowerCase().includes(query) || Object.entries(p.especificaciones || {}).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(query)); if (!hay) return false }
      return true
    })
  }, [categoria, q, cpu, ram, ssd, source, allProducts])

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
  const scrollToServicios = () => {
    if (page === "cart") { window.history.pushState(null, "", base); setPage("home"); setTimeout(() => document.getElementById("servicios")?.scrollIntoView({ behavior: "smooth" }), 120) }
    else document.getElementById("servicios")?.scrollIntoView({ behavior: "smooth" })
  }
  const handleSelectCategory = c => {
    if (page === "cart") { setCategoria(c); window.history.pushState(null, "", base); setPage("home"); setTimeout(scrollToCatalog, 100) }
    else { setCategoria(c); scrollToCatalog() }
  }

  return (
    <div>
      <div style={{ textAlign: "center", padding: "7px 0", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6e6e73", background: "#f5f0ff", borderBottom: "1px solid #e8e8ed" }}>
        parte del ecosistema <a href="http://localhost:5173" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>TechnoStore ↗</a>
      </div>

      <Header
        search={q} onSearchChange={setQ}
        activeCategory={page === "cart" ? "" : categoria}
        cartCount={cartCount} onCart={goCart}
        onSelectCategory={handleSelectCategory} onServicios={scrollToServicios}
      />

      {page === "cart" ? (
        <CartPage onBack={goHome} />
      ) : (
        <main>
          <Hero onExplore={scrollToCatalog} onServicios={scrollToServicios} />
          <section id="catalogo" className="container">
            {(q.trim() || categoria !== "todos") && (
              <nav className="breadcrumbs" aria-label="Filtros activos">
                <button onClick={() => { setCategoria("todos"); scrollToCatalog() }}>Catálogo</button>
                {categoria !== "todos" && <><span>›</span><button onClick={() => setCategoria("todos")}>{categoria}</button></>}
                {q.trim() && <><span>›</span><span className="crumb-q">“{q.trim()}”</span></>}
              </nav>
            )}
            <div className="section-intro">
              <span className="eyebrow">Hardware para IA · ficha técnica</span>
              <h2>GPUs, RAM y SSD <em>para correr modelos en serio</em></h2>
              <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>VRAM, TFLOPS y compatibilidad a la vista. Para quien arma rigs, no para vitrina.</p>
            </div>
            <div className="filter-bar" style={{ marginTop: 20 }}>
              <div className="pill-row" role="tablist">
                {CATS.map(c => (
                  <button key={c.id} role="tab" aria-selected={categoria === c.id} className={`pill ${categoria === c.id ? "active" : ""}`} onClick={() => setCategoria(c.id)}>
                    {c.label} <em>{counts[c.id] ?? 0}</em>
                  </button>
                ))}
              </div>
              <div className="filter-row">
                <label className="filter-select">
                  <span>Procesador</span>
                  <select value={cpu} onChange={e => setCpu(e.target.value)}>
                    <option value="">Todos</option>
                    {specOpts.cpus.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label className="filter-select">
                  <span>Memoria RAM</span>
                  <select value={ram} onChange={e => setRam(e.target.value)}>
                    <option value="">Toda</option>
                    {specOpts.rams.map(gb => <option key={gb} value={gb}>{fmtCap(gb)}</option>)}
                  </select>
                </label>
                <label className="filter-select">
                  <span>Disco</span>
                  <select value={ssd} onChange={e => setSsd(e.target.value)}>
                    <option value="">Todo</option>
                    {specOpts.ssds.map(gb => <option key={gb} value={gb}>{fmtCap(gb)}</option>)}
                  </select>
                </label>
                {(cpu || ram || ssd) && (
                  <button className="pill clear-btn" onClick={() => { setCpu(""); setRam(""); setSsd("") }}>
                    Limpiar specs
                  </button>
                )}
              </div>
              {(cpu || ram || ssd) && (
                <div className="filter-meta">
                  <span className="filter-count">
                    {[cpu && specOpts.cpus.find(o => o.id === cpu)?.label, ram && `${fmtCap(Number(ram))} RAM`, ssd && `${fmtCap(Number(ssd))} SSD`].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </div>
            <ProductGrid products={source === null ? null : visibles} totalLabel={`${(source === null ? 0 : visibles.length)} productos`} onReset={() => { setCategoria("todos"); setQ(""); setCpu(""); setRam(""); setSsd("") }} onDetail={setSelectedProduct} onAddToCart={addToCart} />
          </section>
          <section className="container" style={{ marginTop: 8 }}>
            <div style={{ padding: "12px 16px", border: "1px dashed #e8e8ed", borderRadius: 12, background: "#f5f0ff", fontSize: 12, color: "#6e6e73" }}>
              Tip técnico: para LLM 7B necesitás ~16GB VRAM/RAM · para 70B Q4 ~48GB. Filtrá por VRAM en la ficha.
            </div>
          </section>
          <ServicesSection />
        </main>
      )}

      <Footer onSelectCategory={handleSelectCategory} />
      <WhatsAppFloat />
      {selectedProduct && <ProductDetail producto={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
