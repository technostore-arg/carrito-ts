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
import { matchCpu, matchRam, matchSsd, specOptions, fmtCap, canonCat, buildRanges, matchRange, specsForCat, normText, matchQuery, matchNameSku } from "./utils/specs"

const CATS = [
  { id: "todos", label: "Todos" },
  { id: "gpus", label: "GPUs" },
  { id: "memorias", label: "Memorias RAM" },
  { id: "almacenamiento", label: "Almacenamiento" },
  { id: "procesadores", label: "Procesadores" },
  { id: "workstations", label: "Workstations" },
  { id: "notebooks", label: "Notebooks" },
  { id: "accesorios", label: "Accesorios" },
]

export default function App() {
  const { addToCart, count: cartCount, toast } = useCart()
  const base = import.meta.env.BASE_URL || "/"
  const [page, setPage] = useState(() => (typeof window !== "undefined" && window.location.pathname.includes("carrito") ? "cart" : "home"))
  const [categoria, setCategoria] = useState("todos")
  const [marca, setMarca] = useState("todos")
  const [rango, setRango] = useState("todos")
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
    const m = sp.get("marca"); if (m) setMarca(m)
    const r = sp.get("rango"); if (r) setRango(r)
    const qq = sp.get("q"); if (qq) setQ(qq)
    const cu = sp.get("cpu"); if (cu) setCpu(cu)
    const ra = sp.get("ram"); if (ra) setRam(ra)
    const sd = sp.get("ssd"); if (sd) setSsd(sd)
  }, []) // eslint-disable-line
  useEffect(() => {
    if (page !== "home") return
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (marca !== "todos") sp.set("marca", marca)
    if (rango !== "todos") sp.set("rango", rango)
    if (q.trim()) sp.set("q", q.trim())
    if (cpu) sp.set("cpu", cpu)
    if (ram) sp.set("ram", ram)
    if (ssd) sp.set("ssd", ssd)
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `${base}?${qs}` : base)
  }, [categoria, marca, rango, q, cpu, ram, ssd, page])
  useEffect(() => {
    const h = e => { if (e.key === "Escape") setSelectedProduct(null) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const source = products === null ? null : products
  const allProducts = source ?? []
  const marcasDisponibles = useMemo(() => { if (source === null) return []; return Array.from(new Set(allProducts.map(p => p.marca || 'Genérica'))).sort() }, [allProducts, source])
  const validCatIds = useMemo(() => new Set(CATS.map(c => c.id)), [])
  useEffect(() => {
    if (source === null) return
    if (marca !== "todos" && !marcasDisponibles.includes(marca)) setMarca("todos")
    if (!validCatIds.has(canonCat(categoria))) setCategoria("todos")
    else if (categoria !== canonCat(categoria)) setCategoria(canonCat(categoria))
    if (rango !== "todos" && !/^(\d+-\d+|\d+\+)$/.test(rango)) setRango("todos")
  }, [source, marcasDisponibles, marca, categoria, rango, validCatIds])
  const counts = useMemo(() => { const c = { todos: allProducts.length }; for (const p of allProducts) { const k = canonCat(p.categoria); c[k] = (c[k] || 0) + 1 } return c }, [allProducts])
  const specOpts = useMemo(() => specOptions(allProducts), [allProducts])
  const rangeOpts = useMemo(() => buildRanges(allProducts), [allProducts])
  const visibleSpecs = useMemo(() => specsForCat(categoria), [categoria])
  useEffect(() => {
    if (!visibleSpecs.includes('cpu') && cpu) setCpu("")
    if (!visibleSpecs.includes('ram') && ram) setRam("")
    if (!visibleSpecs.includes('ssd') && ssd) setSsd("")
  }, [categoria]) // eslint-disable-line
  const visibles = useMemo(() => {
    if (source === null) return []
    const query = normText(q.trim())
    const cat = canonCat(categoria)
    let out = allProducts.filter(p => {
      if (cat !== "todos" && canonCat(p.categoria) !== cat) return false
      if (marca !== "todos" && (p.marca || 'Genérica') !== marca) return false
      if (p.tipo_venta === "directa" && !matchRange(p.precio_transferencia ?? p.precio ?? p.price, rango)) return false
      if (p.tipo_venta === "encargo" && rango !== "todos") return false
      if (!matchCpu(p, cpu)) return false
      if (!matchRam(p, ram)) return false
      if (!matchSsd(p, ssd)) return false
      if (!matchQuery(p, query)) return false
      return true
    })
    if (query) {
      const top = [], rest = []
      for (const p of out) (matchNameSku(p, query) ? top : rest).push(p)
      out = [...top, ...rest]
    }
    return out
  }, [categoria, marca, rango, q, cpu, ram, ssd, source, allProducts])

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
            {(q.trim() || categoria !== "todos" || marca !== "todos" || rango !== "todos" || cpu || ram || ssd) && (
              <nav className="breadcrumbs" aria-label="Filtros activos">
                <button onClick={() => { setCategoria("todos"); scrollToCatalog() }}>Catálogo</button>
                {categoria !== "todos" && <><span>›</span><button onClick={() => setCategoria("todos")}>{(CATS.find(c => c.id === canonCat(categoria))?.label) || categoria}</button></>}
                {marca !== "todos" && <><span>›</span><button onClick={() => setMarca("todos")}>{marca}</button></>}
                {rango !== "todos" && <><span>›</span><button onClick={() => setRango("todos")}>{rangeOpts.find(r => r.id === rango)?.label || rango}</button></>}
                {cpu && <><span>›</span><button onClick={() => setCpu("")}>{specOpts.cpus.find(o => o.id === cpu)?.label || cpu}</button></>}
                {ram && <><span>›</span><button onClick={() => setRam("")}>{fmtCap(Number(ram))} RAM</button></>}
                {ssd && <><span>›</span><button onClick={() => setSsd("")}>{fmtCap(Number(ssd))} SSD</button></>}
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
                  <span>Marca</span>
                  <select value={marca} onChange={e => setMarca(e.target.value)}>
                    <option value="todos">Todas las marcas</option>
                    {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="filter-select">
                  <span>Precio</span>
                  <select value={rango} onChange={e => setRango(e.target.value)}>
                    <option value="todos">Todos los precios</option>
                    {rangeOpts.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
                {visibleSpecs.includes('cpu') && (
                  <label className="filter-select">
                    <span>Procesador</span>
                    <select value={cpu} onChange={e => setCpu(e.target.value)}>
                      <option value="">Todos</option>
                      {specOpts.cpus.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </label>
                )}
                {visibleSpecs.includes('ram') && (
                  <label className="filter-select">
                    <span>Memoria RAM</span>
                    <select value={ram} onChange={e => setRam(e.target.value)}>
                      <option value="">Toda</option>
                      {specOpts.rams.map(gb => <option key={gb} value={gb}>{fmtCap(gb)}</option>)}
                    </select>
                  </label>
                )}
                {visibleSpecs.includes('ssd') && (
                  <label className="filter-select">
                    <span>Disco</span>
                    <select value={ssd} onChange={e => setSsd(e.target.value)}>
                      <option value="">Todo</option>
                      {specOpts.ssds.map(gb => <option key={gb} value={gb}>{fmtCap(gb)}</option>)}
                    </select>
                  </label>
                )}
                {(marca !== "todos" || rango !== "todos" || cpu || ram || ssd) && (
                  <button className="pill clear-btn" onClick={() => { setMarca("todos"); setRango("todos"); setCpu(""); setRam(""); setSsd("") }}>
                    Limpiar filtros
                  </button>
                )}
              </div>
              {(marca !== "todos" || rango !== "todos" || cpu || ram || ssd) && (
                <div className="filter-meta">
                  <span className="filter-count">
                    {[marca !== "todos" && marca, rango !== "todos" && (rangeOpts.find(r => r.id === rango)?.label || rango), cpu && specOpts.cpus.find(o => o.id === cpu)?.label, ram && `${fmtCap(Number(ram))} RAM`, ssd && `${fmtCap(Number(ssd))} SSD`].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </div>
            <ProductGrid products={source === null ? null : visibles} totalLabel={`${(source === null ? 0 : visibles.length)} productos`} onReset={() => { setCategoria("todos"); setQ(""); setMarca("todos"); setRango("todos"); setCpu(""); setRam(""); setSsd("") }} onDetail={setSelectedProduct} onAddToCart={addToCart} />
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
