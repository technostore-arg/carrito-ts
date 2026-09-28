import { useMemo, useState, useEffect } from "react"
import Header from "./components/Header"
import Hero from "./components/Hero"
import FilterPanel, { rangoMatch, ORDENES, isHardware, CATEGORIAS } from "./components/FilterPanel"
import { matchCpu, matchRam, matchSsd, specOptions, CPU_LABELS, fmtCap, canonCat, buildRanges, specsForCat, normText, matchQuery, matchNameSku } from "./utils/specs"
import { getBrand } from "./utils/brand"
import ProductGrid from "./components/ProductGrid"
import ProductDetail from "./components/ProductDetail"
import CartPage from "./components/CartPage"
import AppleSpotlight from "./components/AppleSpotlight"
import Footer from "./components/Footer"
import WhatsAppFloat from "./components/WhatsAppFloat"
import { useCart } from "./context/CartContext"

export default function App() {
  const { addToCart, count: cartCount, toast } = useCart()
  const base = import.meta.env.BASE_URL || "/"
  const [page, setPage] = useState(() => (typeof window !== "undefined" && window.location.pathname.includes("carrito") ? "cart" : "home"))
  const [categoria, setCategoria] = useState("todos")
  const [marcas, setMarcas] = useState([])
  const [rango, setRango] = useState("todos")
  const [q, setQ] = useState("")
  const [orden, setOrden] = useState("relevancia")
  const [cpu, setCpu] = useState("")
  const [ram, setRam] = useState("")
  const [ssd, setSsd] = useState("")
  const [condicion, setCondicion] = useState("todos")
  const [calidad, setCalidad] = useState("todos")
  const [batMin, setBatMin] = useState(0)
  const [products, setProducts] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    fetch("/api/products").then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (Array.isArray(data)) {
        // TechnoStore muestra su marca + marcas de fabricantes; las copias
        // exclusivas de futurohard se ocultan para no duplicar por SKU
        const seen = new Set()
        const deduped = []
        const fhOnly = []
        for (const p of data) {
          const marca = (p.marca || "").toLowerCase()
          if (marca === "futurohard") { fhOnly.push(p); continue }
          const key = String(p.sku || p.id)
          if (seen.has(key)) continue
          seen.add(key)
          deduped.push(p)
        }
        // Si un SKU solo existe en versión futurohard, mostrarlo igual (no ocultar stock)
        const dedupedSkus = new Set(deduped.map(p => String(p.sku || p.id)))
        for (const p of fhOnly) {
          if (!dedupedSkus.has(String(p.sku || p.id))) deduped.push(p)
        }
        setProducts(deduped)
      }
    }).catch(() => setProducts([]))
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
    const m = sp.get("marca"); if (m) setMarcas(m.split(",").filter(Boolean))
    const r = sp.get("rango"); if (r) setRango(r)
    const qq = sp.get("q"); if (qq) setQ(qq)
    const o = sp.get("orden"); if (o && ORDENES.some(x => x.id === o)) setOrden(o)
    const cu = sp.get("cpu"); if (cu) setCpu(cu)
    const ra = sp.get("ram"); if (ra) setRam(ra)
    const sd = sp.get("ssd"); if (sd) setSsd(sd)
    const cd = sp.get("cond"); if (cd) setCondicion(cd)
    const ca = sp.get("cal"); if (ca) setCalidad(ca)
    const bt = sp.get("bat"); if (bt) setBatMin(Number(bt) || 0)
  }, []) // eslint-disable-line

  // estado → URL (solo en home)
  useEffect(() => {
    if (page !== "home") return
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (marcas.length) sp.set("marca", marcas.join(","))
    if (rango !== "todos") sp.set("rango", rango)
    if (q.trim()) sp.set("q", q.trim())
    if (orden !== "relevancia") sp.set("orden", orden)
    if (cpu) sp.set("cpu", cpu)
    if (ram) sp.set("ram", ram)
    if (ssd) sp.set("ssd", ssd)
    if (condicion !== "todos") sp.set("cond", condicion)
    if (calidad !== "todos") sp.set("cal", calidad)
    if (batMin > 0) sp.set("bat", String(batMin))
    const qs = sp.toString()
    const url = qs ? `${base}?${qs}` : base
    window.history.replaceState(null, "", url)
  }, [categoria, marcas, rango, q, orden, cpu, ram, ssd, condicion, calidad, batMin, page])

  useEffect(() => {
    const h = e => { if (e.key === "Escape") setSelectedProduct(null) }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  const source = products === null ? null : products
  const allProducts = source ?? []
  // Productos que pertenecen a la categoría activa (para acotar marcas/precios/specs)
  const scopedProducts = useMemo(() => {
    if (source === null) return null
    if (categoria === "hardware") return allProducts.filter(p => isHardware(p.categoria))
    const cat = canonCat(categoria)
    if (cat === "todos") return allProducts
    return allProducts.filter(p => canonCat(p.categoria) === cat)
  }, [allProducts, source, categoria])
  const marcasDisponibles = useMemo(() => {
    if (scopedProducts === null) return []
    return Array.from(new Set(scopedProducts.map(getBrand))).sort()
  }, [scopedProducts, source])

  // Auto-curar filtros inválidos (ej. marca guardada en URL que ya no existe en el catálogo)
  const validCatIds = useMemo(() => new Set(CATEGORIAS.map(c => c.id)), [])
  const hasUsed = useMemo(() => (scopedProducts ?? []).some(p => p.condicion === "usado"), [scopedProducts, source])
  useEffect(() => {
    if (source === null) return
    if (marcas.length) {
      const valid = marcas.filter(m => marcasDisponibles.includes(m))
      if (valid.length !== marcas.length) setMarcas(valid)
    }
    if (!validCatIds.has(canonCat(categoria))) setCategoria("todos")
    else if (categoria !== canonCat(categoria)) setCategoria(canonCat(categoria))
    if (rango !== "todos" && !/^(\d+-\d+|\d+\+)$/.test(rango)) setRango("todos")
    if (!hasUsed && (condicion !== "todos" || calidad !== "todos" || batMin > 0)) {
      setCondicion("todos"); setCalidad("todos"); setBatMin(0)
    }
  }, [source, marcasDisponibles, marcas, categoria, rango, validCatIds, hasUsed, condicion, calidad, batMin])
  const counts = useMemo(() => { const c = { todos: allProducts.length, hardware: 0 }; for (const p of allProducts) { const k = canonCat(p.categoria); c[k] = (c[k] || 0) + 1; if (isHardware(p.categoria)) c.hardware++ } return c }, [allProducts])
  const marcaCounts = useMemo(() => {
    const m = {}
    for (const p of scopedProducts ?? []) { const b = getBrand(p); m[b] = (m[b] || 0) + 1 }
    return m
  }, [scopedProducts, source])
  const specOpts = useMemo(() => specOptions(scopedProducts ?? []), [scopedProducts, source])
  const rangeOpts = useMemo(() => buildRanges(scopedProducts ?? []), [scopedProducts, source])
  const visibleSpecs = useMemo(() => specsForCat(categoria), [categoria])
  // Al cambiar de categoría se limpian los filtros de specs que dejan de aplicar
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
      if (categoria === "hardware" ? !isHardware(p.categoria) : (cat !== "todos" && canonCat(p.categoria) !== cat)) return false
      if (marcas.length && !marcas.includes(getBrand(p))) return false
      if (p.tipo_venta === "directa" && !rangoMatch(p.precio, rango)) return false
      if (p.tipo_venta === "encargo" && rango !== "todos") return false
      if (condicion !== "todos" && (p.condicion === "usado" ? "usado" : "nuevo") !== condicion) return false
      if (calidad !== "todos" && p.especificaciones?._calidad !== calidad) return false
      if (batMin > 0 && (Number(p.especificaciones?._bateria) || 0) < batMin) return false
      if (!matchCpu(p, cpu)) return false
      if (!matchRam(p, ram)) return false
      if (!matchSsd(p, ssd)) return false
      if (!matchQuery(p, query)) return false
      return true
    })
    // Con búsqueda: primero coincidencias en nombre/SKU
    if (query) {
      const top = [], rest = []
      for (const p of out) (matchNameSku(p, query) ? top : rest).push(p)
      out = [...top, ...rest]
    }
    if (orden === "precio-asc") out = [...out].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0))
    else if (orden === "precio-desc") out = [...out].sort((a, b) => (b.precio ?? 0) - (a.precio ?? 0))
    else if (orden === "nombre-asc") out = [...out].sort((a, b) => a.nombre.localeCompare(b.nombre))
    return out
  }, [categoria, marcas, rango, condicion, calidad, batMin, q, orden, cpu, ram, ssd, source, allProducts])

  const hasFiltros = categoria !== "todos" || marcas.length > 0 || rango !== "todos" || q.trim() !== "" || orden !== "relevancia" || cpu !== "" || ram !== "" || ssd !== "" || condicion !== "todos" || calidad !== "todos" || batMin > 0
  const limpiarFiltros = () => {
    setCategoria("todos"); setMarcas([]); setRango("todos"); setQ(""); setOrden("relevancia")
    setCpu(""); setRam(""); setSsd(""); setCondicion("todos"); setCalidad("todos"); setBatMin(0)
  }

  // Chips de filtros activos (reemplazan breadcrumbs)
  const chips = useMemo(() => {
    const out = []
    if (categoria !== "todos") out.push({ id: "cat", label: CATEGORIAS.find(c => c.id === canonCat(categoria))?.label || categoria, onRemove: () => setCategoria("todos") })
    for (const m of marcas) out.push({ id: `m:${m}`, label: m, onRemove: () => setMarcas(prev => prev.filter(x => x !== m)) })
    if (rango !== "todos") out.push({ id: "rango", label: rangeOpts.find(r => r.id === rango)?.label || rango, onRemove: () => setRango("todos") })
    if (condicion !== "todos") out.push({ id: "cond", label: condicion === "usado" ? "Usado" : "Nuevo", onRemove: () => setCondicion("todos") })
    if (calidad !== "todos") out.push({ id: "cal", label: `Calidad ${calidad}`, onRemove: () => setCalidad("todos") })
    if (batMin > 0) out.push({ id: "bat", label: `Batería ≥ ${batMin}%`, onRemove: () => setBatMin(0) })
    if (cpu) out.push({ id: "cpu", label: CPU_LABELS[cpu] || cpu, onRemove: () => setCpu("") })
    if (ram) out.push({ id: "ram", label: `${fmtCap(Number(ram))} RAM`, onRemove: () => setRam("") })
    if (ssd) out.push({ id: "ssd", label: `${fmtCap(Number(ssd))} SSD`, onRemove: () => setSsd("") })
    if (q.trim()) out.push({ id: "q", label: `“${q.trim()}”`, onRemove: () => setQ("") })
    return out
  }, [categoria, marcas, rango, condicion, calidad, batMin, cpu, ram, ssd, q, rangeOpts])

  // Sugerencias del buscador (top matches en nombre/SKU)
  const searchSuggests = useMemo(() => {
    const t = normText(q.trim())
    if (t.length < 2 || source === null) return []
    return allProducts.filter(p => matchNameSku(p, t)).slice(0, 6)
  }, [q, source, allProducts])

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })

  const handleApple = () => {
    setCategoria("todos"); setMarcas(["Apple"]); setRango("todos")
    setCondicion("todos"); setCalidad("todos"); setBatMin(0)
    if (page === "cart") {
      window.history.pushState(null, "", base)
      setPage("home")
      setTimeout(scrollToCatalog, 100)
    } else scrollToCatalog()
  }

  const handleSelectCategory = c => {
    if (c === "apple") { handleApple(); return }
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
        activeBrand={page === "cart" ? "" : (categoria === "todos" && marcas.length === 1 && marcas[0] === "Apple" ? "Apple" : "")}
        cartCount={cartCount}
        onCart={goCart}
        onSelectCategory={handleSelectCategory}
        suggestions={searchSuggests}
        onOpenProduct={setSelectedProduct}
        onSeeAllResults={scrollToCatalog}
      />

      {page === "cart" ? (
        <CartPage onBack={goHome} />
      ) : (
        <main>
          <Hero onExplore={scrollToCatalog} />
          {source !== null && categoria === "todos" && marcas.length === 0 && !q.trim() && (
            <AppleSpotlight products={allProducts} onOpen={setSelectedProduct} onVerTodos={handleApple} />
          )}
          <section id="catalogo" className="container">
            <div className="section-intro">
              <span className="eyebrow">Catálogo TechnoStore</span>
              <h2>Todo lo que necesitás, <em>a un clic</em></h2>
              <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>Celulares, notebooks, computadoras y accesorios con fotos reales, precios claros y filtros que ayudan.</p>
            </div>
            <FilterPanel
              categoria={categoria} marcas={marcas} rango={rango} orden={orden} cpu={cpu} ram={ram} ssd={ssd}
              condicion={condicion} calidad={calidad} batMin={batMin}
              onCategoria={c => { setCategoria(c); scrollToCatalog() }}
              onMarcas={setMarcas} onRango={setRango} onOrden={setOrden} onCpu={setCpu} onRam={setRam} onSsd={setSsd}
              onCondicion={setCondicion} onCalidad={setCalidad} onBatMin={setBatMin}
              marcasDisponibles={marcasDisponibles} marcaCounts={marcaCounts}
              cpuOptions={specOpts.cpus} ramOptions={specOpts.rams} ssdOptions={specOpts.ssds} rangeOptions={rangeOpts} visibleSpecs={visibleSpecs} counts={counts}
              hasUsed={hasUsed} chips={chips}
              totalVisibles={visibles.length} totalAll={allProducts.length}
              hasFiltros={hasFiltros} onLimpiar={limpiarFiltros}
            >
              <ProductGrid
                products={source === null ? null : visibles}
                totalLabel={`${(source === null ? 0 : visibles.length)} producto${(source === null ? 0 : visibles.length) === 1 ? "" : "s"}`}
                onReset={limpiarFiltros}
                onDetail={setSelectedProduct} onAddToCart={addToCart}
              />
            </FilterPanel>
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
