const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "celulares", label: "Celulares" },
  { id: "notebooks", label: "Notebooks" },
  { id: "computadoras", label: "Computadoras" },
  { id: "accesorios", label: "Accesorios" },
]

const RANGOS = [
  { id: "todos", label: "Todos los precios" },
  { id: "0-400", label: "Hasta $400.000" },
  { id: "400-700", label: "$400.000 — $700.000" },
  { id: "700-1200", label: "$700.000 — $1.200.000" },
  { id: "1200+", label: "Más de $1.200.000" },
]

function rangoMatch(precio, rango) {
  if (rango === "todos") return true
  if (rango === "0-400") return precio <= 400000
  if (rango === "400-700") return precio > 400000 && precio <= 700000
  if (rango === "700-1200") return precio > 700000 && precio <= 1200000
  if (rango === "1200+") return precio > 1200000
  return true
}

const ORDENES = [
  { id: "relevancia", label: "Relevancia" },
  { id: "precio-asc", label: "Menor precio" },
  { id: "precio-desc", label: "Mayor precio" },
  { id: "nombre-asc", label: "A — Z" },
]

export default function FilterBar({ categoria, marca, rango, orden, onCategoria, onMarca, onRango, onOrden, marcasDisponibles, counts, totalVisibles, totalAll, hasFiltros, onLimpiar }) {
  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <span className="filter-label">Categoría</span>
          <div className="pill-row" role="tablist">
            {CATEGORIAS.map(c => (
              <button key={c.id} role="tab" aria-selected={categoria === c.id} className={`pill ${categoria === c.id ? "active" : ""}`} onClick={() => onCategoria(c.id)}>
                {c.label} <em>{counts[c.id] ?? 0}</em>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="filter-row">
        <label className="filter-select">
          <span>Marca</span>
          <select value={marca} onChange={e => onMarca(e.target.value)}>
            <option value="todos">Todas las marcas</option>
            {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span>Precio</span>
          <select value={rango} onChange={e => onRango(e.target.value)}>
            {RANGOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span>Ordenar</span>
          <select value={orden} onChange={e => onOrden(e.target.value)}>
            {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="filter-meta">
        <span className="filter-count">{totalVisibles === totalAll ? `${totalAll} productos` : `${totalVisibles} de ${totalAll} productos`}</span>
        {hasFiltros && <button className="filter-clear" onClick={onLimpiar}>Limpiar filtros</button>}
      </div>
    </div>
  )
}

export { rangoMatch, ORDENES }
