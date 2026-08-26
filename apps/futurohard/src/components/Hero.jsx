import { CountUp } from '../hooks/motion'
import HeroVideo from './HeroVideo'

const POSTER = 'assets/video/futurohard-poster.jpg'

export default function Hero({ onExplore }) {
  return (
    <>
      <HeroVideo src="assets/video/futurohard-hero.mp4" poster={POSTER}>
        <span className="hero-tag">Vertical IA · ecosistema TechnoStore</span>
        <h1>Hardware para <br />correr IA en serio</h1>
        <p className="hero-sub">
          GPUs 16–48GB VRAM, memorias ECC y rigs armados para Ollama, vLLM y ComfyUI.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onExplore}>Explorar hardware IA</button>
          <a className="btn-ghost" href="#servicios" onClick={e=>{e.preventDefault();document.getElementById('servicios')?.scrollIntoView({behavior:'smooth'})}}>Instalación de modelos</a>
        </div>
        <div className="hero-proof">
          <span className="proof-stars">★★★★★</span> +120 rigs entregados · 48GB VRAM máx.
        </div>
      </HeroVideo>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['GPUs 48GB VRAM','Ollama · vLLM · ComfyUI','Testeado 48h','Soporte CUDA','Envío a todo el país'].flatMap(x=>[x,x]).map((item,i)=>(
            <span key={i}>{item} <i>·</i></span>
          ))}
        </div>
      </div>
    </>
  )
}
