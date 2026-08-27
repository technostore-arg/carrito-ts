import { CountUp } from '../hooks/motion'

const POSTER = 'assets/video/technostore-poster.jpg'
const VIDEO = 'assets/video/technostore-hero.mp4'

export default function Hero({ onExplore }) {
  const base = import.meta.env.BASE_URL || '/'
  const videoSrc = VIDEO.startsWith('/') ? VIDEO : base + VIDEO
  const posterSrc = POSTER.startsWith('/') ? POSTER : base + POSTER
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <span className="hero-tag">Nueva colección 2026</span>
          <h1>
            Tecnología que <span className="grad-text">impulsa</span> tu mundo
          </h1>
          <p className="hero-sub">
            Celulares, notebooks y hardware con precios imbatibles,
            envío gratis y garantía oficial.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>Ver catálogo</button>
            <button className="btn-ghost" onClick={onExplore}>Ver ofertas</button>
          </div>
          <div className="hero-proof">
            <span className="proof-stars">★★★★★</span> 4.9 · +15.000 clientes
          </div>
        </div>

        <div className="hero-media">
          <video autoPlay muted loop playsInline preload="metadata" poster={posterSrc}>
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
      </section>

      <div className="diagonal-break" aria-hidden />
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['Envío gratis desde $300.000','Hasta 12 cuotas','Garantía oficial','Soporte real','Diagnóstico sin cargo'].flatMap(x=>[x,x]).map((item,i)=>(
            <span key={i}>{item} <i>◆</i></span>
          ))}
        </div>
      </div>
      <div className="diagonal-break--alt" aria-hidden />
    </>
  )
}
