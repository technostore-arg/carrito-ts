// Categorías de componentes que agrupa la vista virtual "Hardware"
const HARDWARE_CATS = ["gpus", "procesadores", "ram", "ram-sodimm", "memorias", "ssd", "ssd-nvme", "ssd-sata", "coolers", "gabinetes", "watercooling"]
const isHardware = c => HARDWARE_CATS.includes(String(c || "").toLowerCase())

const CATEGORIAS = [
  { id: "todos", label: "Todos" },
  { id: "celulares", label: "Celulares" },
  { id: "notebooks", label: "Notebooks" },
  { id: "hardware", label: "Hardware" },
  { id: "gpus", label: "Placas de Video" },
  { id: "procesadores", label: "Procesadores" },
  { id: "memorias", label: "Memorias RAM" },
  { id: "almacenamiento", label: "Almacenamiento" },
  { id: "coolers", label: "Coolers" },
  { id: "gabinetes", label: "Gabinetes" },
  { id: "watercooling", label: "Watercooling" },
  { id: "accesorios", label: "Accesorios" },
]

// Compat: acepta ids viejos ("0-400", "ram", ...) y rangos dinámicos "min-max"/"min+"
function rangoMatch(precio, rango) {
  if (!rango || rango === "todos") return true
  const p = Number(precio) || 0
  let m = String(rango).match(/^(\d+)-(\d+)$/)
  if (m) {
    // rangos legacy en miles ("0-400" = hasta $400.000)
    const mult = Number(m[2]) <= 10000 ? 1000 : 1
    return p >= Number(m[1]) * mult && p <= Number(m[2]) * mult
  }
  m = String(rango).match(/^(\d+)\+$/)
  if (m) {
    const mult = Number(m[1]) <= 10000 ? 1000 : 1
    return p > Number(m[1]) * mult
  }
  return true
}

const ORDENES = [
  { id: "relevancia", label: "Relevancia" },
  { id: "precio-asc", label: "Menor precio" },
  { id: "precio-desc", label: "Mayor precio" },
  { id: "nombre-asc", label: "A — Z" },
]

export default function FilterBar({ categoria, marca, rango, orden, cpu, ram, ssd, onCategoria, onMarca, onRango, onOrden, onCpu, onRam, onSsd, marcasDisponibles, cpuOptions, ramOptions, ssdOptions, rangeOptions, visibleSpecs, counts, totalVisibles, totalAll, hasFiltros, onLimpiar }) {
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
            <option value="todos">Todos los precios</option>
            {rangeOptions.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label className="filter-select">
          <span>Ordenar</span>
          <select value={orden} onChange={e => onOrden(e.target.value)}>
            {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        {visibleSpecs.includes('cpu') && (
          <label className="filter-select">
            <span>Procesador</span>
            <select value={cpu} onChange={e => onCpu(e.target.value)}>
              <option value="">Todos</option>
              {cpuOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )}
        {visibleSpecs.includes('ram') && (
          <label className="filter-select">
            <span>Memoria RAM</span>
            <select value={ram} onChange={e => onRam(e.target.value)}>
              <option value="">Toda</option>
              {ramOptions.map(gb => <option key={gb} value={gb}>{gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`}</option>)}
            </select>
          </label>
        )}
        {visibleSpecs.includes('ssd') && (
          <label className="filter-select">
            <span>Disco</span>
            <select value={ssd} onChange={e => onSsd(e.target.value)}>
              <option value="">Todo</option>
              {ssdOptions.map(gb => <option key={gb} value={gb}>{gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="filter-meta">
        <span className="filter-count">{totalVisibles === totalAll ? `${totalAll} productos` : `${totalVisibles} de ${totalAll} productos`}</span>
        {hasFiltros && <button className="filter-clear" onClick={onLimpiar}>Limpiar filtros</button>}
      </div>
    </div>
  )
}

export { rangoMatch, ORDENES, HARDWARE_CATS, isHardware, CATEGORIAS }
