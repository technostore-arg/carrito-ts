import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import Header from "./components/Header"
import Hero from "./components/Hero"
import FilterBar, { rangoMatch } from "./components/FilterBar"
import ProductGrid from "./components/ProductGrid"
import Footer from "./components/Footer"
import { mockProducts } from "./data/mockProducts"

function getBrand(p) {
  const n = p.nombre || ""
  if (n.startsWith("iPhone") || n.startsWith("AirPods") || n.startsWith("MacBook")) return "Apple"
  if (n.startsWith("Samsung")) return "Samsung"
  if (n.startsWith("Google")) return "Google"
  if (n.startsWith("Dell")) return "Dell"
  if (n.startsWith("Lenovo")) return "Lenovo"
  if (n.startsWith("ASUS")) return "ASUS"
  if (n.startsWith("PC Gamer") || n.startsWith("Mini PC")) return "Armados"
  if (n.startsWith("Teclado") || n.startsWith("SSD")) return "Accesorios"
  return "Otros"
}

export default function App() {
  const [categoria, setCategoria] = useState("todos")
  const [marca, setMarca] = useState("todos")
  const [rango, setRango] = useState("todos")
  const [q, setQ] = useState("")

  const marcasDisponibles = useMemo(() => {
    const set = new Set(mockProducts.map(getBrand))
    return Array.from(set).sort()
  }, [])

  const counts = useMemo(() => {
    const c = { todos: mockProducts.length }
    for (const p of mockProducts) c[p.categoria] = (c[p.categoria] || 0) + 1
    return c
  }, [])

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    return mockProducts.filter(p => {
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
  }, [categoria, marca, rango, q])

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
      <Header
        search={q}
        onSearchChange={setQ}
        onSelectCategory={c => {
          setCategoria(c)
          scrollToCatalog()
        }}
      />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}>
        <Hero onExplore={scrollToCatalog} />
        <section id="catalogo" className="container">
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
              onCategoria={setCategoria}
              onMarca={setMarca}
              onRango={setRango}
              marcasDisponibles={marcasDisponibles}
              counts={counts}
            />
          </div>

          <ProductGrid
            products={visibles}
            totalLabel={`${visibles.length} producto${visibles.length === 1 ? "" : "s"}`}
            onReset={() => {
              setCategoria("todos")
              setMarca("todos")
              setRango("todos")
              setQ("")
            }}
          />
        </section>
      </motion.main>
      <Footer onSelectCategory={setCategoria} />
    </motion.div>
  )
}
