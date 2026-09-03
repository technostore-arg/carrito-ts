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
          <span className="hero-tag">Vertical IA · TechnoStore</span>
          <h1>Hardware para <em>IA real</em></h1>
          <p className="hero-sub">GPUs 24–48GB VRAM, RAM ECC y rigs armados para Ollama, vLLM y ComfyUI. Testeado 48h, listo para producir.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>Explorar hardware IA</button>
            <button className="btn-ghost" onClick={onServicios}>Instalación de modelos</button>
          </div>
          <div className="hero-proof"><span className="proof-stars">★★★★★</span> 4.9 — +120 rigs entregados</div>
        </div>
        <div className="hero-media">
          <video autoPlay muted loop playsInline preload="metadata" poster={posterSrc} onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling && (e.target.nextElementSibling.style.display = 'block') }}>
            <source src={videoSrc} type="video/mp4" />
          </video>
          <div className="hero-fallback" style={{ display: 'none', backgroundImage: `url(${posterSrc})` }} />
        </div>
      </section>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {['NVIDIA','AMD','Intel','ASUS ROG','Corsair','Kingston','MSI','Gigabyte','NVIDIA','AMD','Intel','ASUS ROG','Corsair','Kingston','MSI','Gigabyte','NVIDIA','AMD','Intel','ASUS ROG','Corsair','Kingston','MSI','Gigabyte','NVIDIA','AMD','Intel','ASUS ROG','Corsair','Kingston','MSI','Gigabyte'].map((item,i)=>(
            <span key={i}>{item} <i>·</i></span>
          ))}
        </div>
      </div>
    </>
  )
}
