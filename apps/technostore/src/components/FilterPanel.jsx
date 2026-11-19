/**
 * Panel de filtros (TechnoStore) — facetas profesionales con estilo sobrio.
 * Desktop: sidebar. Móvil: bottom-sheet (botón "Filtros").
 * Filtros: VRAM, precio, marca y estado + el resto del catálogo.
 */
import { useState } from "react"

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

function Facet({ title, hint, children }) {
  return (
    <div className="ts-facet">
      <h4 className="ts-facet__title">{title}</h4>
      {hint && <p className="ts-facet__hint">{hint}</p>}
      {children}
    </div>
  )
}

function FacetOpt({ active, label, count, onClick, type = "radio" }) {
  return (
    <button type="button" className={['ts-facet-opt', active ? 'is-active' : ''].join(' ')} onClick={onClick} role={type === "radio" ? "radio" : "checkbox"} aria-checked={active}>
      <span className={`ts-facet-opt__mark ts-facet-opt__mark--${type}`} aria-hidden />
      <span className="ts-facet-opt__label">{label}</span>
      {count != null && <span className="ts-facet-opt__count">{count}</span>}
    </button>
  )
}

export default function FilterPanel({
  categoria, marcas, rango, orden, vram, cpu, ram, ssd, condicion, calidad, batMin, disponibilidad,
  onCategoria, onMarcas, onRango, onOrden, onVram, onCpu, onRam, onSsd, onCondicion, onCalidad, onBatMin, onDisponibilidad,
  marcasDisponibles, marcaCounts, cpuOptions, ramOptions, ssdOptions, vramOptions, rangeOptions,
  visibleSpecs, counts, hasUsed, chips, totalVisibles, totalAll, hasFiltros, onLimpiar, children,
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = () => setSheetOpen(false)

  const toggleMarca = m => onMarcas(marcas.includes(m) ? marcas.filter(x => x !== m) : [...marcas, m])
  const vramVal = String(vram ?? '')
  const activeCount =
    (categoria !== "todos" ? 1 : 0) + marcas.length + (rango !== "todos" ? 1 : 0) +
    (vramVal !== "" ? 1 : 0) + (condicion !== "todos" ? 1 : 0) + (calidad !== "todos" ? 1 : 0) + (batMin > 0 ? 1 : 0) +
    (disponibilidad !== "todos" ? 1 : 0) + (cpu ? 1 : 0) + (ram ? 1 : 0) + (ssd ? 1 : 0)

  const facets = (
    <div className="ts-facet-list">
      <Facet title="Categoría">
        <div className="ts-facet-opts" role="radiogroup">
          {CATEGORIAS.map(c => (
            <FacetOpt key={c.id} active={categoria === c.id} label={c.label} count={counts[c.id] ?? 0} onClick={() => onCategoria(c.id)} />
          ))}
        </div>
      </Facet>

      <Facet title="Marca" hint="Filtra por marca">
        <div className="ts-facet-opts ts-facet-opts--scroll" role="group">
          <FacetOpt active={marcas.length === 0} label="Todas" onClick={() => onMarcas([])} type="radio" />
          {marcasDisponibles.map(m => (
            <FacetOpt key={m} active={marcas.includes(m)} label={m} count={marcaCounts[m] ?? 0} onClick={() => toggleMarca(m)} type="checkbox" />
          ))}
        </div>
      </Facet>

      {visibleSpecs.includes("vram") && vramOptions?.length > 0 && (
        <Facet title="VRAM (placas de video)">
          <div className="ts-facet-opts ts-facet-opts--wrap" role="radiogroup">
            <FacetOpt active={!vramVal} label="Toda" onClick={() => onVram('')} />
            {vramOptions.map(v => (
              <FacetOpt key={v} active={vramVal === String(v)} label={`${v}GB`} onClick={() => onVram(vramVal === String(v) ? '' : String(v))} />
            ))}
          </div>
        </Facet>
      )}

      {hasUsed && (
        <Facet title="Condición">
          <div className="ts-facet-opts" role="radiogroup">
            <FacetOpt active={condicion === "todos"} label="Todos" onClick={() => onCondicion("todos")} />
            <FacetOpt active={condicion === "nuevo"} label="Nuevo" onClick={() => onCondicion("nuevo")} />
            <FacetOpt active={condicion === "usado"} label="Usado" onClick={() => onCondicion("usado")} />
          </div>
        </Facet>
      )}

      <Facet title="Disponibilidad">
        <div className="ts-facet-opts" role="radiogroup">
          <FacetOpt active={disponibilidad === "todos"} label="Todos" onClick={() => onDisponibilidad("todos")} />
          <FacetOpt active={disponibilidad === "hoy"} label="Entrega hoy" onClick={() => onDisponibilidad("hoy")} />
        </div>
      </Facet>

      <Facet title="Precio">
        <div className="ts-facet-opts" role="radiogroup">
          <FacetOpt active={rango === "todos"} label="Todos los precios" onClick={() => onRango("todos")} />
          {rangeOptions.map(r => <FacetOpt key={r.id} active={rango === r.id} label={r.label} onClick={() => onRango(r.id)} />)}
        </div>
      </Facet>

      {visibleSpecs.includes("cpu") && cpuOptions.length > 0 && (
        <Facet title="Procesador">
          <div className="ts-facet-opts ts-facet-opts--scroll" role="radiogroup">
            <FacetOpt active={!cpu} label="Todos" onClick={() => onCpu("")} />
            {cpuOptions.map(o => <FacetOpt key={o.id} active={cpu === o.id} label={o.label} onClick={() => onCpu(cpu === o.id ? "" : o.id)} />)}
          </div>
        </Facet>
      )}

      {visibleSpecs.includes("ram") && ramOptions.length > 0 && (
        <Facet title="Memoria RAM">
          <div className="ts-facet-opts ts-facet-opts--wrap" role="radiogroup">
            <FacetOpt active={!ram} label="Toda" onClick={() => onRam("")} />
            {ramOptions.map(gb => <FacetOpt key={gb} active={String(ram) === String(gb)} label={gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`} onClick={() => onRam(ram === String(gb) ? "" : String(gb))} />)}
          </div>
        </Facet>
      )}

      {visibleSpecs.includes("ssd") && ssdOptions.length > 0 && (
        <Facet title="Disco">
          <div className="ts-facet-opts ts-facet-opts--wrap" role="radiogroup">
            <FacetOpt active={!ssd} label="Todo" onClick={() => onSsd("")} />
            {ssdOptions.map(gb => <FacetOpt key={gb} active={String(ssd) === String(gb)} label={gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`} onClick={() => onSsd(ssd === String(gb) ? "" : String(gb))} />)}
          </div>
        </Facet>
      )}

      {hasFiltros && (
        <button className="ts-filter-clear" onClick={() => { onLimpiar(); closeSheet() }}>Limpiar todos los filtros</button>
      )}
    </div>
  )

  return (
    <div className="ts-catalog-shell">
      <div className="ts-catalog-toolbar">
        <button type="button" className="ts-filters-fab" onClick={() => setSheetOpen(true)}>
          Filtros {activeCount > 0 && <em>{activeCount}</em>}
        </button>
        <button type="button" className={['ts-quick-avail', disponibilidad === "hoy" ? "is-active" : ""].join(' ')} onClick={() => onDisponibilidad(disponibilidad === "hoy" ? "todos" : "hoy")} aria-pressed={disponibilidad === "hoy"}>
          Entrega hoy
        </button>
        <span className="ts-filter-count">{totalVisibles === totalAll ? `${totalAll} productos` : `${totalVisibles} de ${totalAll} productos`}</span>
        <div className="ts-chips" role="list">
          {chips.map(c => (
            <button key={c.id} type="button" className="ts-chip" role="listitem" onClick={c.onRemove} title="Quitar filtro">
              {c.label} <span aria-hidden>✕</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ts-catalog-sidebar">{facets}</div>

      <div className="ts-catalog-main">{children}</div>

      {sheetOpen && (
        <div className="ts-sheet-overlay" onClick={closeSheet}>
          <div className="ts-sheet" role="dialog" aria-label="Filtros del catálogo" onClick={e => e.stopPropagation()}>
            <div className="ts-sheet__head">
              <h3>Filtros</h3>
              <button type="button" className="ts-sheet-close" onClick={closeSheet} aria-label="Cerrar filtros">✕</button>
            </div>
            <div className="ts-sheet-body">{facets}</div>
            <div className="ts-sheet-foot">
              <button className="ts-btn ts-btn--primary ts-sheet-apply" onClick={closeSheet}>Aplicar filtros</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
