import { ars } from '../utils/format'

const FW_LABELS = {
  ollama: 'Ollama',
  vllm: 'vLLM',
  comfyui: 'ComfyUI',
  pytorch: 'PyTorch',
  lmstudio: 'LM Studio',
  openwebui: 'OpenWebUI',
}

export default function GpuCompare({ products }) {
  const gpus = products
    .filter(p => p.vram && (p.category === 'gpus' || p.category === 'workstations'))
    .sort((a, b) => b.vram - a.vram || (b.cuda ?? 0) - (a.cuda ?? 0))

  if (gpus.length === 0) return null

  return (
    <section id="comparativa" className="container compare-section">
      <span className="eyebrow">Comparativa</span>
      <h2>
        ¿Cuánta <span className="grad-text">VRAM</span> necesitás?
      </h2>
      <p className="compare-sub">
        Regla rápida: LLM cuantizados Q4 consumen ~0.6GB por parámetro. Un modelo de
        70B entra en 48GB; Flux Dev necesita 16-24GB.
      </p>
      <div className="table-scroll card">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Equipo / GPU</th>
              <th>Marca</th>
              <th>VRAM</th>
              <th>CUDA</th>
              <th>TFLOPS FP16</th>
              <th>Frameworks verificados</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {gpus.map(p => (
              <tr key={p.id}>
                <td><b>{p.name}</b></td>
                <td>{p.brand}</td>
                <td><span className={`vram-tag ${p.vram >= 24 ? 'big' : ''}`}>{p.vram}GB</span></td>
                <td>{p.cuda ? p.cuda.toLocaleString('es-AR') : '—'}</td>
                <td>{p.tflops ?? '—'}</td>
                <td>
                  {p.frameworks?.length > 0 ? (
                    <div className="fw-chips">
                      {p.frameworks.map(f => (
                        <span key={f}>{FW_LABELS[f] ?? f}</span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td><b>{ars(p.price)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
