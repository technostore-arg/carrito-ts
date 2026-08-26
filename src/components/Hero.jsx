import { CountUp } from '../hooks/motion'
import { waLink } from '../utils/format'

const MARQUEE = [
  'GPUs hasta 48GB de VRAM',
  'Corré Ollama · vLLM · ComfyUI en local',
  'Envío gratis desde $300.000',
  'Hasta 12 cuotas con MercadoPago',
  'Workstations armadas y testeadas 48h',
  'Soporte CUDA y ROCm especializado',
]

export default function Hero({ onExplore }) {
  return (
    <section className="hero">
      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="hero-tag">⚡ Especialistas en hardware de IA · Palermo, CABA</span>
          <h1>
            Tu rig de IA <span className="grad-text">empieza acá</span>
          </h1>
          <p>
            Placas gráficas de 16 a 48GB de VRAM, memorias DDR5/ECC y workstations
            armadas para correr Ollama, vLLM, ComfyUI y Stable Diffusion — listas
            para producir desde el primer encendido.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>
              Explorar catálogo →
            </button>
            <a className="btn-ghost" href="#servicios">
              🔧 Servicio de instalación IA
            </a>
          </div>
          <div className="hero-proof">
            <span className="proof-stars">★★★★★</span> 4.9/5 · +150 reseñas en Google Maps
          </div>
          <div className="hero-stats">
            <div>
              <b><CountUp to={120} prefix="+" /></b>
              <small>rigs IA entregados</small>
            </div>
            <div>
              <b><CountUp to={48} suffix="GB" /></b>
              <small>VRAM máxima configurada</small>
            </div>
            <div>
              <b>24h</b>
              <small>despacho stock</small>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-glow" />
          <div className="float-chip chip-a">🧠</div>
          <div className="float-chip chip-b">🎮</div>
          <div className="float-chip chip-c">💾</div>
          <div className="float-chip chip-d">🖥️</div>
          <div className="float-chip chip-e">⚡</div>
          <div className="float-card">
            <span>🚚 Envío GRATIS</span>
            <small>en compras desde $300.000</small>
          </div>
        </div>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i}>
              {item} <i>✦</i>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
