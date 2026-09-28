import { useState } from "react"

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

const CALIDADES = ["A+", "A", "A-"]
const BAT_MIN_OPTS = [100, 95, 90, 85]

function Facet({ title, children, hint }) {
  return (
    <div className="facet">
      <h4 className="facet-title">{title}</h4>
      {hint && <p className="facet-hint">{hint}</p>}
      {children}
    </div>
  )
}

function FacetOpt({ active, label, count, onClick, type = "radio" }) {
  return (
    <button type="button" className={`facet-opt ${active ? "active" : ""}`} onClick={onClick} role={type === "radio" ? "radio" : "checkbox"} aria-checked={active}>
      <span className={`facet-mark facet-mark--${type}`} aria-hidden />
      <span className="facet-opt-label">{label}</span>
      {count != null && <span className="facet-opt-count">{count}</span>}
    </button>
  )
}

/**
 * Panel de filtros con facetas.
 * Desktop: sidebar sticky. Móvil: bottom-sheet (botón "Filtros").
 * Renderiza `children` como contenido principal (el grid).
 */
export default function FilterPanel({
  categoria, marcas, rango, orden, cpu, ram, ssd, condicion, calidad, batMin,
  onCategoria, onMarcas, onRango, onOrden, onCpu, onRam, onSsd, onCondicion, onCalidad, onBatMin,
  marcasDisponibles, marcaCounts, cpuOptions, ramOptions, ssdOptions, rangeOptions,
  visibleSpecs, counts, hasUsed, chips, totalVisibles, totalAll, hasFiltros, onLimpiar, children,
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = () => setSheetOpen(false)

  const toggleMarca = m => {
    onMarcas(marcas.includes(m) ? marcas.filter(x => x !== m) : [...marcas, m])
  }
  const activeCount =
    (categoria !== "todos" ? 1 : 0) + marcas.length + (rango !== "todos" ? 1 : 0) +
    (condicion !== "todos" ? 1 : 0) + (calidad !== "todos" ? 1 : 0) + (batMin > 0 ? 1 : 0) +
    (cpu ? 1 : 0) + (ram ? 1 : 0) + (ssd ? 1 : 0)

  const facets = (
    <div className="facet-list">
      <Facet title="Categoría">
        <div className="facet-opts" role="radiogroup">
          {CATEGORIAS.map(c => (
            <FacetOpt key={c.id} active={categoria === c.id} label={c.label} count={counts[c.id] ?? 0} onClick={() => onCategoria(c.id)} />
          ))}
        </div>
      </Facet>

      <Facet title="Marca">
        <div className="facet-opts facet-opts--scroll" role="group">
          <FacetOpt active={marcas.length === 0} label="Todas" onClick={() => onMarcas([])} type="radio" />
          {marcasDisponibles.map(m => (
            <FacetOpt key={m} active={marcas.includes(m)} label={m} count={marcaCounts[m] ?? 0} onClick={() => toggleMarca(m)} type="checkbox" />
          ))}
        </div>
      </Facet>

      {hasUsed && (
        <Facet title="Condición">
          <div className="facet-opts" role="radiogroup">
            <FacetOpt active={condicion === "todos"} label="Todos" onClick={() => onCondicion("todos")} />
            <FacetOpt active={condicion === "nuevo"} label="Nuevo" onClick={() => onCondicion("nuevo")} />
            <FacetOpt active={condicion === "usado"} label="Usado" onClick={() => onCondicion("usado")} />
          </div>
        </Facet>
      )}

      {hasUsed && condicion !== "nuevo" && (
        <Facet title="Calidad (usados)">
          <div className="facet-opts" role="radiogroup">
            <FacetOpt active={calidad === "todos"} label="Todas" onClick={() => onCalidad("todos")} />
            {CALIDADES.map(c => <FacetOpt key={c} active={calidad === c} label={`Calidad ${c}`} onClick={() => onCalidad(c)} />)}
          </div>
        </Facet>
      )}

      {hasUsed && condicion !== "nuevo" && (
        <Facet title="Batería mínima">
          <div className="facet-opts facet-opts--wrap" role="radiogroup">
            <FacetOpt active={batMin === 0} label="Todas" onClick={() => onBatMin(0)} />
            {BAT_MIN_OPTS.map(b => <FacetOpt key={b} active={batMin === b} label={`≥ ${b}%`} onClick={() => onBatMin(b)} />)}
          </div>
        </Facet>
      )}

      <Facet title="Precio">
        <div className="facet-opts" role="radiogroup">
          <FacetOpt active={rango === "todos"} label="Todos los precios" onClick={() => onRango("todos")} />
          {rangeOptions.map(r => <FacetOpt key={r.id} active={rango === r.id} label={r.label} onClick={() => onRango(r.id)} />)}
        </div>
      </Facet>

      {visibleSpecs.includes("cpu") && cpuOptions.length > 0 && (
        <Facet title="Procesador">
          <div className="facet-opts facet-opts--scroll" role="radiogroup">
            <FacetOpt active={!cpu} label="Todos" onClick={() => onCpu("")} />
            {cpuOptions.map(o => <FacetOpt key={o.id} active={cpu === o.id} label={o.label} onClick={() => onCpu(cpu === o.id ? "" : o.id)} />)}
          </div>
        </Facet>
      )}

      {visibleSpecs.includes("ram") && ramOptions.length > 0 && (
        <Facet title="Memoria RAM">
          <div className="facet-opts facet-opts--wrap" role="radiogroup">
            <FacetOpt active={!ram} label="Toda" onClick={() => onRam("")} />
            {ramOptions.map(gb => <FacetOpt key={gb} active={String(ram) === String(gb)} label={gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`} onClick={() => onRam(ram === String(gb) ? "" : String(gb))} />)}
          </div>
        </Facet>
      )}

      {visibleSpecs.includes("ssd") && ssdOptions.length > 0 && (
        <Facet title="Disco">
          <div className="facet-opts facet-opts--wrap" role="radiogroup">
            <FacetOpt active={!ssd} label="Todo" onClick={() => onSsd("")} />
            {ssdOptions.map(gb => <FacetOpt key={gb} active={String(ssd) === String(gb)} label={gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`} onClick={() => onSsd(ssd === String(gb) ? "" : String(gb))} />)}
          </div>
        </Facet>
      )}

      {hasFiltros && (
        <button className="filter-clear" onClick={() => { onLimpiar(); closeSheet() }}>Limpiar todos los filtros</button>
      )}
    </div>
  )

  return (
    <div className="catalog-shell">
      <div className="catalog-toolbar">
        <button type="button" className="filters-fab" onClick={() => setSheetOpen(true)}>
          Filtros {activeCount > 0 && <em>{activeCount}</em>}
        </button>
        <span className="filter-count">{totalVisibles === totalAll ? `${totalAll} productos` : `${totalVisibles} de ${totalAll} productos`}</span>
        <div className="chips" role="list">
          {chips.map(c => (
            <button key={c.id} type="button" className="chip" role="listitem" onClick={c.onRemove} title="Quitar filtro">
              {c.label} <span aria-hidden>✕</span>
            </button>
          ))}
        </div>
        <label className="filter-select filter-select--orden">
          <span>Ordenar</span>
          <select value={orden} onChange={e => onOrden(e.target.value)}>
            {ORDENES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="catalog-layout">
        <aside className={`filter-panel ${sheetOpen ? "open" : ""}`} aria-label="Filtros">
          <div className="sheet-head">
            <h4>Filtros {activeCount > 0 ? `(${activeCount})` : ""}</h4>
            <button type="button" className="sheet-close" onClick={closeSheet} aria-label="Cerrar filtros">✕</button>
          </div>
          {facets}
        </aside>
        {sheetOpen && <div className="sheet-overlay" onClick={closeSheet} />}
        <div className="catalog-main">{children}</div>
      </div>
    </div>
  )
}

export { rangoMatch, ORDENES, HARDWARE_CATS, isHardware, CATEGORIAS, CALIDADES, BAT_MIN_OPTS }
