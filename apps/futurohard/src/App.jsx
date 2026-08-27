import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import Header from "./components/Header"
import Hero from "./components/Hero"
import ProductGrid from "./components/ProductGrid"
import ServicesSection from "./components/ServicesSection"
import Footer from "./components/Footer"
import { mockProducts } from "./data/mockProducts"

const CATS = [
  { id: "todos", label: "Todos" },
  { id: "gpus", label: "GPUs" },
  { id: "memorias", label: "RAM / SSD" },
  { id: "workstations", label: "Workstations" },
]

export default function App() {
  const [categoria, setCategoria] = useState("todos")
  const [q, setQ] = useState("")

  const counts = useMemo(() => {
    const c = { todos: mockProducts.length }
    for (const p of mockProducts) c[p.categoria] = (c[p.categoria] || 0) + 1
    return c
  }, [])

  const visibles = useMemo(() => {
    const query = q.trim().toLowerCase()
    return mockProducts.filter(p => {
      if (categoria !== "todos" && p.categoria !== categoria) return false
      if (query) {
        const hay =
          p.nombre.toLowerCase().includes(query) ||
          p.descripcion.toLowerCase().includes(query) ||
          Object.entries(p.especificaciones || {}).some(([k, v]) => `${k} ${v}`.toLowerCase().includes(query))
        if (!hay) return false
      }
      return true
    })
  }, [categoria, q])

  const scrollToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
  const scrollToServicios = () => document.getElementById("servicios")?.scrollIntoView({ behavior: "smooth" })

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}>
      <div
        style={{
          textAlign: "center",
          padding: "7px 0",
          fontSize: "12px",
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#8e8e93",
          background: "rgba(94,92,230,0.08)",
          borderBottom: "1px solid #1e2230",
        }}
      >
        parte del ecosistema{" "}
        <a href="http://localhost:5173" style={{ color: "#5e5ce6", fontWeight: 700, textDecoration: "none" }}>
          TechnoStore ↗
        </a>
      </div>

      <Header
        search={q}
        onSearchChange={setQ}
        onSelectCategory={c => {
          setCategoria(c)
          scrollToCatalog()
        }}
        onServicios={scrollToServicios}
      />

      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}>
        <Hero onExplore={scrollToCatalog} onServicios={scrollToServicios} />

        <section id="catalogo" className="container">
          <div className="section-intro">
            <span className="eyebrow mono">Hardware para IA · ficha técnica</span>
            <h2>
              GPUs, RAM y SSD <span style={{ color: "var(--blue)" }}>para correr modelos en serio</span>
            </h2>
            <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
              VRAM, TFLOPS y compatibilidad a la vista. Diseñado para quien arma rigs, no para vitrina.
            </p>
          </div>

          <div className="filter-bar" style={{ marginTop: 22 }}>
            <div className="pill-row" role="tablist">
              {CATS.map(c => (
                <motion.button
                  key={c.id}
                  role="tab"
                  aria-selected={categoria === c.id}
                  className={`pill ${categoria === c.id ? "active" : ""}`}
                  onClick={() => setCategoria(c.id)}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {c.label} <em>{counts[c.id] ?? 0}</em>
                </motion.button>
              ))}
            </div>
          </div>

          <ProductGrid
            products={visibles}
            totalLabel={`${visibles.length} producto${visibles.length === 1 ? "" : "s"}`}
            onReset={() => {
              setCategoria("todos")
              setQ("")
            }}
          />
        </section>

        <section className="container" style={{ marginTop: 8 }}>
          <div
            style={{
              padding: "14px 16px",
              border: "1px dashed #1e2230",
              borderRadius: 12,
              background: "rgba(94,92,230,0.06)",
              fontSize: 13,
              color: "#8e8e93",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            Tip técnico: para LLM 7B necesitás ~16GB VRAM/RAM · para 70B Q4 ~48GB. Filtrá por VRAM en la ficha del producto.
          </div>
        </section>

        <ServicesSection />
      </motion.main>

      <Footer onSelectCategory={setCategoria} />
    </motion.div>
  )
}
