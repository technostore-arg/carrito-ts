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
          <h1>Tecnología que <em>impulsa</em> tu mundo</h1>
          <p className="hero-sub">Celulares, notebooks y hardware con precios imbatibles, envío gratis y garantía oficial.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={onExplore}>Ver catálogo</button>
            <button className="btn-ghost" onClick={onExplore}>Ver ofertas</button>
          </div>
          <div className="hero-proof"><span className="proof-stars">★★★★★</span> 4.9 · +15.000 clientes</div>
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
          {['Samsung','Xiaomi','Apple','Motorola','Lenovo','HP','Dell','ASUS','Samsung','Xiaomi','Apple','Motorola','Lenovo','HP','Dell','ASUS','Samsung','Xiaomi','Apple','Motorola','Lenovo','HP','Dell','ASUS','Samsung','Xiaomi','Apple','Motorola','Lenovo','HP','Dell','ASUS'].map((item,i)=>(
            <span key={i}>{item} <i>·</i></span>
          ))}
        </div>
      </div>
    </>
  )
}
