/** Hero principal de la tienda (TechnoStore): Rigs para IA que corren. */
import { Button } from './Button.jsx'

const POSTER = 'assets/video/technostore-poster.jpg'
const VIDEO = 'assets/video/technostore-hero.mp4'

export default function Hero({ onExplore }) {
  const base = import.meta.env.BASE_URL || '/'
  const videoSrc = VIDEO.startsWith('/') ? VIDEO : base + VIDEO
  const posterSrc = POSTER.startsWith('/') ? POSTER : base + POSTER
  return (
    <section className="ts-hero">
      <div className="ts-hero__body">
        <span className="ts-hero__tag">Hardware de IA premium</span>
        <h1 className="ts-hero__title">
          Rigs para IA <span className="ts-hero__accent">que corren</span>.
        </h1>
        <p className="ts-hero__sub">
          Workstations armadas, GPUs de alta VRAM, RAM DDR5 ECC y memorias para modelos locales. Probados por tu equipo.
        </p>
        <div className="ts-hero__actions">
          <Button variant="primary" onClick={onExplore}>Ver catálogo</Button>
        </div>
      </div>
      <div className="ts-hero__media">
        <video autoPlay muted loop playsInline preload="metadata" poster={posterSrc}
          onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling && (e.target.nextElementSibling.style.display = 'block') }}>
          <source src={videoSrc} type="video/mp4" />
        </video>
        <div className="ts-hero__fallback" style={{ display: 'none', backgroundImage: `url(${posterSrc})` }} />
      </div>
    </section>
  )
}
