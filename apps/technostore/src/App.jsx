import { useMemo, useState, useEffect, useRef } from "react"
import Header from "./components/Header"
import Hero from "./components/Hero"
import FilterPanel, { rangoMatch, ORDENES, isHardware, CATEGORIAS } from "./components/FilterPanel"
import { matchCpu, matchRam, matchSsd, specOptions, CPU_LABELS, fmtCap, canonCat, buildRanges, specsForCat, normText, matchQuery, matchNameSku } from "./utils/specs"
import { getBrand } from "./utils/brand"
import ProductGrid from "./components/ProductGrid"
import ProductDetail from "./components/ProductDetail"
import DrawerCart from "./components/DrawerCart"
import MobileCartBar from "./components/MobileCartBar"
import Checkout from "./components/Checkout"
import useCatalog from "./hooks/useCatalog"
import useDebouncedValue from "./hooks/useDebouncedValue"
import { mergeQuotes } from "./data/catalog.js"
import { SEARCH_DEBOUNCE_MS } from "./config/store"
import AppleSpotlight from "./components/AppleSpotlight"
import Footer from "./components/Footer"
import CustomerAuth from "./components/CustomerAuth"
import { authClient } from "./lib/auth.js"
import WhatsAppFloat from "./components/WhatsAppFloat"
import { useCart } from "./context/CartContext"

export default function App() {
  const { addToCart, count: cartCount, toast } = useCart()
  const base = import.meta.env.BASE_URL || "/"
  const { products, loading, refreshQuotes } = useCatalog()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSession, setAuthSession] = useState(null)

  // El wrapper de Neon canjea el neon_auth_session_verifier al llamar getSession.
  // Guardamos la sesión en la app para que el modal la vea apenas vuelve de Google.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data } = await authClient.getSession()
        if (alive && data?.user) setAuthSession(data.user)
      } catch { /* sin sesión */ }
    }
    load()
    if (new URLSearchParams(window.location.search).has('neon_auth_session_verifier')) {
      const t = setTimeout(load, 1500)
      return () => { alive = false; clearTimeout(t) }
    }
    return () => { alive = false }
  }, [])

  // Neon Auth puede volver con ?error=... después del login social.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const err = sp.get('error')
    if (!err) return
    setAuthError(err === 'state_not_found'
      ? 'La sesión de acceso venció. Probá iniciar de nuevo.'
      : `No se pudo completar el ingreso (${err})`)
    setAuthOpen(true)
    sp.delete('error')
    const qs = sp.toString()
    window.history.replaceState(null, '', `${base}${qs ? `?${qs}` : ''}`)
  }, [base])

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
  const [disponibilidad, setDisponibilidad] = useState("todos")
  const [selectedProduct, setSelectedProduct] = useState(null)

  // El input responde al instante; el filtrado espera 250ms (CRO + CPU).
  const qDebounced = useDebouncedValue(q, SEARCH_DEBOUNCE_MS)

  // URL → estado inicial
  useEffect(() => {
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
    const dp = sp.get("disp"); if (dp === "hoy") setDisponibilidad("hoy")
  }, []) // eslint-disable-line

  // estado → URL (la búsqueda usa el valor con debounce)
  useEffect(() => {
    const sp = new URLSearchParams()
    if (categoria !== "todos") sp.set("cat", categoria)
    if (marcas.length) sp.set("marca", marcas.join(","))
    if (rango !== "todos") sp.set("rango", rango)
    if (qDebounced.trim()) sp.set("q", qDebounced.trim())
    if (orden !== "relevancia") sp.set("orden", orden)
    if (cpu) sp.set("cpu", cpu)
    if (ram) sp.set("ram", ram)
    if (ssd) sp.set("ssd", ssd)
    if (condicion !== "todos") sp.set("cond", condicion)
    if (calidad !== "todos") sp.set("cal", calidad)
    if (batMin > 0) sp.set("bat", String(batMin))
    if (disponibilidad === "hoy") sp.set("disp", "hoy")
    // No pisar el verifier de OAuth mientras se canjea la sesión.
    const current = new URLSearchParams(window.location.search)
    const verifier = current.get("neon_auth_session_verifier")
    if (verifier) sp.set("neon_auth_session_verifier", verifier)
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `${base}?${qs}` : base)
  }, [categoria, marcas, rango, qDebounced, orden, cpu, ram, ssd, condicion, calidad, batMin, disponibilidad, base])

  useEffect(() => {
    const h = e => {
      if (e.key !== "Escape") return
      if (checkoutOpen) setCheckoutOpen(false)
      else if (drawerOpen) setDrawerOpen(false)
      else setSelectedProduct(null)
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [drawerOpen, checkoutOpen])

  const source = loading ? null : products
  const allProducts = source ?? []
  const scopedProducts = useMemo(() => {
    if (source === null) return null
    if (categoria === "hardware") return allProducts.filter(p => isHardware(p.categoria))
    const cat = canonCat(categoria)
    if (cat === "todos") return allProducts
    return allProducts.filter(p => canonCat(p.categoria) === cat)
  }, [allProducts, source, categoria])

  const marcasDisponibles = useMemo(() =>
    scopedProducts === null ? [] : Array.from(new Set(scopedProducts.map(getBrand))).sort(),
  [scopedProducts])

  const validCatIds = useMemo(() => new Set(CATEGORIAS.map(c => c.id)), [])
  const hasUsed = useMemo(() => (scopedProducts ?? []).some(p => p.condicion === "usado"), [scopedProducts])

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

  const counts = useMemo(() => {
    const c = { todos: allProducts.length, hardware: 0 }
    for (const p of allProducts) {
      const k = canonCat(p.categoria)
      c[k] = (c[k] || 0) + 1
      if (isHardware(p.categoria)) c.hardware++
    }
    return c
  }, [allProducts])
  const marcaCounts = useMemo(() => {
    const m = {}
    for (const p of scopedProducts ?? []) { const b = getBrand(p); m[b] = (m[b] || 0) + 1 }
    return m
  }, [scopedProducts])
  const specOpts = useMemo(() => specOptions(scopedProducts ?? []), [scopedProducts])
  const rangeOpts = useMemo(() => buildRanges(scopedProducts ?? []), [scopedProducts])
  const visibleSpecs = useMemo(() => specsForCat(categoria), [categoria])

  useEffect(() => {
    if (!visibleSpecs.includes("cpu") && cpu) setCpu("")
    if (!visibleSpecs.includes("ram") && ram) setRam("")
    if (!visibleSpecs.includes("ssd") && ssd) setSsd("")
  }, [categoria]) // eslint-disable-line

  const visibles = useMemo(() => {
    if (source === null) return []
    const query = normText(qDebounced.trim())
    const cat = canonCat(categoria)
    let out = allProducts.filter(p => {
      if (categoria === "hardware" ? !isHardware(p.categoria) : (cat !== "todos" && canonCat(p.categoria) !== cat)) return false
      if (marcas.length && !marcas.includes(getBrand(p))) return false
      if (disponibilidad === "hoy" && !(p.stock_source !== "supplier" && Number(p.stock) > 0)) return false
      if (p.tipo_venta === "directa" && !rangoMatch(p.precio_transferencia ?? p.precio, rango)) return false
      if (p.tipo_venta === "encargo" && rango !== "todos") return false
      if (condicion !== "todos" && (p.condicion === "usado" ? "usado" : "nuevo") !== condicion) return false
      if (calidad !== "todos" && p.especificaciones?._calidad !== calidad) return false
      if (batMin > 0 && (Number(p.especificaciones?._bateria_min ?? p.especificaciones?._bateria) || 0) < batMin) return false
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
    if (orden === "precio-asc") out = [...out].sort((a, b) => (a.precio_transferencia ?? a.precio ?? 0) - (b.precio_transferencia ?? b.precio ?? 0))
    else if (orden === "precio-desc") out = [...out].sort((a, b) => (b.precio_transferencia ?? b.precio ?? 0) - (a.precio_transferencia ?? a.precio ?? 0))
    else if (orden === "nombre-asc") out = [...out].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
    return out
  }, [categoria, marcas, rango, condicion, calidad, batMin, disponibilidad, qDebounced, orden, cpu, ram, ssd, source, allProducts])

  const hasFiltros = categoria !== "todos" || marcas.length > 0 || rango !== "todos" || qDebounced.trim() !== "" || orden !== "relevancia" || cpu !== "" || ram !== "" || ssd !== "" || condicion !== "todos" || calidad !== "todos" || batMin > 0 || disponibilidad !== "todos"
  const limpiarFiltros = () => {
    setCategoria("todos"); setMarcas([]); setRango("todos"); setQ(""); setOrden("relevancia")
    setCpu(""); setRam(""); setSsd(""); setCondicion("todos"); setCalidad("todos"); setBatMin(0); setDisponibilidad("todos")
  }

  const chips = useMemo(() => {
    const out = []
    if (categoria !== "todos") out.push({ id: "cat", label: CATEGORIAS.find(c => c.id === canonCat(categoria))?.label || categoria, onRemove: () => setCategoria("todos") })
    for (const m of marcas) out.push({ id: `m:${m}`, label: m, onRemove: () => setMarcas(prev => prev.filter(x => x !== m)) })
    if (rango !== "todos") out.push({ id: "rango", label: rangeOpts.find(r => r.id === rango)?.label || rango, onRemove: () => setRango("todos") })
    if (disponibilidad === "hoy") out.push({ id: "disp", label: "Entrega hoy", onRemove: () => setDisponibilidad("todos") })
    if (condicion !== "todos") out.push({ id: "cond", label: condicion === "usado" ? "Usado" : "Nuevo", onRemove: () => setCondicion("todos") })
    if (calidad !== "todos") out.push({ id: "cal", label: `Calidad ${calidad}`, onRemove: () => setCalidad("todos") })
    if (batMin > 0) out.push({ id: "bat", label: `Batería ≥ ${batMin}%`, onRemove: () => setBatMin(0) })
    if (cpu) out.push({ id: "cpu", label: CPU_LABELS[cpu] || cpu, onRemove: () => setCpu("") })
    if (ram) out.push({ id: "ram", label: `${fmtCap(Number(ram))} RAM`, onRemove: () => setRam("") })
    if (ssd) out.push({ id: "ssd", label: `${fmtCap(Number(ssd))} SSD`, onRemove: () => setSsd("") })
    if (qDebounced.trim()) out.push({ id: "q", label: `“${qDebounced.trim()}”`, onRemove: () => setQ("") })
    return out
  }, [categoria, marcas, rango, disponibilidad, condicion, calidad, batMin, cpu, ram, ssd, qDebounced, rangeOpts])

  const searchSuggests = useMemo(() => {
    const t = normText(qDebounced.trim())
    if (t.length < 2 || source === null) return []
    return allProducts.filter(p => matchNameSku(p, t)).slice(0, 6)
  }, [qDebounced, source, allProducts])

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })

  // Links precargados por el agente (?cart=SKU:2,SKU2:1) -> DrawerCart.
  const cartPreloadDone = useRef(false)
  useEffect(() => {
    if (source === null || cartPreloadDone.current) return
    const sp = new URLSearchParams(window.location.search)
    const raw = sp.get("cart")
    if (!raw) return
    cartPreloadDone.current = true
    const wanted = raw.split(",").slice(0, 10).map(part => {
      const [sku, qty] = part.split(":")
      return { sku: String(sku || "").toUpperCase(), qty: Math.min(Math.max(Number(qty) || 1, 1), 10) }
    })
    ;(async () => {
      // Esperamos a la cotización real para no precargar productos a $0.
      const quotes = await refreshQuotes(wanted.map(w => w.sku))
      const resolved = mergeQuotes(allProducts, quotes)
      for (const item of wanted) {
        const product = resolved.find(p => String(p.sku || "").toUpperCase() === item.sku)
        if (!product || !(Number(product.precio_transferencia) > 0) || product.quarantined) continue
        for (let i = 0; i < item.qty; i++) addToCart(product)
      }
      sp.delete("cart")
      const qs = sp.toString()
      window.history.replaceState(null, "", qs ? `${base}?${qs}` : base)
      setTimeout(() => setDrawerOpen(true), 100)
    })()
  }, [source]) // eslint-disable-line

  const openProduct = p => {
    // Precio/stock se refrescan al abrir el detalle, sin recargar fotos.
    if (p?.sku) refreshQuotes([p.sku]).catch(() => {})
    setSelectedProduct(p)
  }

  const handleApple = () => {
    setCategoria("todos"); setMarcas(["Apple"]); setRango("todos")
    setCondicion("todos"); setCalidad("todos"); setBatMin(0); setDisponibilidad("todos")
    scrollToCatalog()
  }
  const handleSelectCategory = c => {
    if (c === "apple") { handleApple(); return }
    setCategoria(c)
    scrollToCatalog()
  }

  const openCheckout = () => { setDrawerOpen(false); setSelectedProduct(null); setCheckoutOpen(true) }

  return (
    <div>
      <Header
        search={q}
        onSearchChange={setQ}
        activeCategory={categoria}
        activeBrand={categoria === "todos" && marcas.length === 1 && marcas[0] === "Apple" ? "Apple" : ""}
        cartCount={cartCount}
        onCart={() => setDrawerOpen(true)}
        onAccount={() => setAuthOpen(true)}
        onSelectCategory={handleSelectCategory}
        suggestions={searchSuggests}
        onOpenProduct={openProduct}
        onSeeAllResults={scrollToCatalog}
      />

      <main>
        <Hero onExplore={scrollToCatalog} />
        {source !== null && categoria === "todos" && marcas.length === 0 && !qDebounced.trim() && (
          <AppleSpotlight products={allProducts} onOpen={openProduct} onVerTodos={handleApple} />
        )}
        <section id="catalogo" className="container">
          {source !== null && allProducts.length === 0 ? (
            <div className="catalog-empty">
              <span className="eyebrow">Catálogo en renovación</span>
              <h2>Estamos armando una selección <em>más corta y mejor</em></h2>
              <p>Volvemos en breve con los productos que mejor rotan: iPhones nuevos y usados con garantía, MacBooks, SSD, memorias y periféricos. Si necesitás algo puntual, escribinos.</p>
              <a className="btn-primary" href="https://wa.me/5491127650658?text=Hola%2C%20quiero%20consultar%20por%20un%20producto" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
            </div>
          ) : (
            <>
              <div className="section-intro">
                <span className="eyebrow">Catálogo TechnoStore</span>
                <h2>Todo lo que necesitás, <em>a un clic</em></h2>
                <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>Celulares, notebooks, hardware y accesorios con precios claros, envío gratis y filtros que ayudan.</p>
              </div>
              <FilterPanel
                categoria={categoria} marcas={marcas} rango={rango} orden={orden} cpu={cpu} ram={ram} ssd={ssd}
                condicion={condicion} calidad={calidad} batMin={batMin} disponibilidad={disponibilidad}
                onCategoria={c => { setCategoria(c); scrollToCatalog() }}
                onMarcas={setMarcas} onRango={setRango} onOrden={setOrden} onCpu={setCpu} onRam={setRam} onSsd={setSsd}
                onCondicion={setCondicion} onCalidad={setCalidad} onBatMin={setBatMin} onDisponibilidad={setDisponibilidad}
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
                  onDetail={openProduct} onAddToCart={addToCart}
                />
              </FilterPanel>
            </>
          )}
        </section>
      </main>

      <Footer onSelectCategory={handleSelectCategory} />
      <WhatsAppFloat />

      <MobileCartBar onOpenCart={() => setDrawerOpen(true)} onCheckout={openCheckout} />
      <DrawerCart open={drawerOpen} onClose={() => setDrawerOpen(false)} onCheckout={openCheckout} />
      {checkoutOpen && <Checkout onClose={() => setCheckoutOpen(false)} />}
      <CustomerAuth open={authOpen} onClose={() => setAuthOpen(false)} initialError={authError} session={authSession} onSession={setAuthSession} />
      {selectedProduct && <ProductDetail producto={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
