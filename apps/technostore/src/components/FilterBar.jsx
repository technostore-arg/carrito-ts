import { motion } from "framer-motion"

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "celulares", label: "Celulares" },
  { id: "notebooks", label: "Notebooks" },
  { id: "computadoras", label: "Computadoras" },
  { id: "accesorios", label: "Accesorios" },
]

const RANGOS = [
  { id: "todos", label: "Todos los precios" },
  { id: "0-300", label: "Hasta $300.000" },
  { id: "300-800", label: "$300.000 — $800.000" },
  { id: "800-1500", label: "$800.000 — $1.500.000" },
  { id: "1500+", label: "Más de $1.500.000" },
]

function rangoMatch(precio, rango) {
  if (rango === "todos") return true
  if (rango === "0-300") return precio <= 300000
  if (rango === "300-800") return precio > 300000 && precio <= 800000
  if (rango === "800-1500") return precio > 800000 && precio <= 1500000
  if (rango === "1500+") return precio > 1500000
  return true
}

export default function FilterBar({ categoria, marca, rango, onCategoria, onMarca, onRango, marcasDisponibles, counts }) {
  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <span className="filter-label">Categoría</span>
          <div className="pill-row" role="tablist">
            {CATEGORIAS.map(c => (
              <motion.button
                key={c.id}
                role="tab"
                aria-selected={categoria === c.id}
                className={`pill ${categoria === c.id ? "active" : ""}`}
                onClick={() => onCategoria(c.id)}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {c.label} <em>{counts[c.id] ?? 0}</em>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="filter-row filter-row--secondary">
        <label className="filter-select">
          <span>Marca</span>
          <select value={marca} onChange={e => onMarca(e.target.value)}>
            <option value="todos">Todas las marcas</option>
            {marcasDisponibles.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-select">
          <span>Precio</span>
          <select value={rango} onChange={e => onRango(e.target.value)}>
            {RANGOS.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

export { rangoMatch }
