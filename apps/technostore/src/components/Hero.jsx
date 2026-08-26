import { CountUp } from '../hooks/motion'
import HeroVideo from './HeroVideo'

const POSTER = 'assets/video/technostore-poster.jpg'

export default function Hero({ onExplore }) {
  return (
    <>
      <HeroVideo src="assets/video/technostore-hero.mp4" poster={POSTER}>
        <span className="hero-tag">Servicio técnico profesional · Palermo</span>
        <h1>Tecnología que <br />impulsa tu mundo</h1>
        <p className="hero-sub">
          Celulares, notebooks y hardware con garantía oficial y soporte real.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onExplore}>Ver catálogo</button>
          <a className="btn-ghost" href="https://wa.me/5491127650658" target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
        </div>
        <div className="hero-proof">
          <span className="proof-stars">★★★★★</span> 4.9 · +150 reseñas
        </div>
      </HeroVideo>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['Envío gratis desde $300.000','Hasta 12 cuotas','Garantía oficial','Soporte real','Diagnóstico sin cargo'].flatMap(x=>[x,x]).map((item,i)=>(
            <span key={i}>{item} <i>·</i></span>
          ))}
        </div>
      </div>
    </>
  )
}
