import { CountUp } from '../hooks/motion'

const POSTER = 'assets/video/futurohard-poster.jpg'
const VIDEO = 'assets/video/futurohard-hero.mp4'

export default function Hero({ onExplore, onServicios }) {
  const base = import.meta.env.BASE_URL || '/'
  const videoSrc = VIDEO.startsWith('/') ? VIDEO : base + VIDEO
  const posterSrc = POSTER.startsWith('/') ? POSTER : base + POSTER
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="hero-tag" style={{ color: 'var(--celeste)', background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.2)' }}>Vertical IA - TechnoStore</span>
          <h1>
            Hardware para <span className="grad-text">IA real</span>
          </h1>
          <p className="hero-sub">
            GPUs 24-48GB VRAM, RAM ECC y rigs armados para Ollama, vLLM y ComfyUI.
            Testeado 48h, listo para producir.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>Explorar hardware IA</button>
            <button className="btn-ghost" onClick={onServicios}>Instalacion de modelos</button>
          </div>
          <div className="hero-proof">
            <span className="proof-stars">★★★★★</span> 4.9 - +120 rigs entregados
          </div>
        </div>
        <div className="hero-media" style={{ borderColor: 'rgba(168,85,247,0.18)' }}>
          <video autoPlay muted loop playsInline preload="metadata" poster={posterSrc}>
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
      </section>
      <div className="diagonal-break" aria-hidden />
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['VRAM 48GB','Ollama vLLM','ComfyUI 48h','CUDA 12','Soporte real'].flatMap(x=>[x,x]).map((item,i)=>(
            <span key={i}>{item} <i>◆</i></span>
          ))}
        </div>
      </div>
      <div className="diagonal-break--alt" aria-hidden />
    </>
  )
}
