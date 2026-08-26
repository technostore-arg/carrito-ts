const SORTS = [
  { id: 'destacados', label: 'Destacados' },
  { id: 'precio-asc', label: 'Menor precio' },
  { id: 'precio-desc', label: 'Mayor precio' },
  { id: 'rating', label: 'Mejor valorados' },
]

const VRAMS = [
  { value: '', label: 'Toda VRAM' },
  { value: '16', label: '16 GB+' },
  { value: '24', label: '24 GB+' },
  { value: '48', label: '48 GB+' },
]

const FRAMEWORKS = [
  { value: '', label: 'Todos los frameworks' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'vllm', label: 'vLLM' },
  { value: 'comfyui', label: 'ComfyUI / SDXL' },
  { value: 'pytorch', label: 'PyTorch' },
  { value: 'lmstudio', label: 'LM Studio' },
]

export default function CategoryFilter({
  active,
  labels,
  counts,
  onChange,
  sort,
  onSortChange,
  vram,
  onVramChange,
  framework,
  onFrameworkChange,
}) {
  return (
    <>
      <div className="section-head">
        <div className="filter-pills" role="tablist">
          {Object.entries(labels).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              className={`pill ${active === id ? 'active' : ''}`}
              onClick={() => onChange(id)}
            >
              {label} <em>{counts[id] ?? 0}</em>
            </button>
          ))}
        </div>
        <label className="sort-wrap">
          <span>Ordenar:</span>
          <select value={sort} onChange={e => onSortChange(e.target.value)}>
            {SORTS.map(s => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(active === 'todos' || active === 'gpus' || active === 'workstations') && (
        <div className="extra-filters">
          <label className="sort-wrap">
            <span>🎯 VRAM:</span>
            <select
              value={vram}
              onChange={e => onVramChange(e.target.value)}
              disabled={active === 'workstations'}
            >
              {VRAMS.map(v => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sort-wrap">
            <span>🧰 Framework:</span>
            <select value={framework} onChange={e => onFrameworkChange(e.target.value)}>
              {FRAMEWORKS.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {(vram || framework) && (
            <button className="pill clear-btn" onClick={() => {
              onVramChange('')
              onFrameworkChange('')
            }}>
              ✕ Limpiar filtros IA
            </button>
          )}
        </div>
      )}
    </>
  )
}
