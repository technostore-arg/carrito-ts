/**
 * Home — adaptación de las 7 secciones del diseño Stitch "TechnoStore Design System"
 * (hero, pasarelas, categorías, más vendidos, cybertrust, prueba social, concierge).
 * Datos reales del catálogo; promos informativas (sin reclamos de descuentos no respaldados).
 */
import ProductCard from './ProductCard.jsx'
import { waLink } from '../utils/format.js'

const PAY_CARDS = [
  { id: 'openpay', logo: '/payments/openpay.svg', title: 'Openpay BBVA', text: 'Cuotas y beneficios para clientes BBVA según campaña vigente.', tag: 'Promos bancarias' },
  { id: 'sipago', logo: '/payments/sipago.svg', title: 'SiPago Credicoop', text: 'Financiación con Cabal Credicoop y tarjetas de otros bancos.', tag: 'Cuotas disponibles' },
  { id: 'transferencia', logo: null, title: 'Transferencia / DEBIN', text: 'Pago directo con acreditación inmediata y precio de transferencia.', tag: 'Menor precio' },
  { id: 'mercadopago', logo: '/payments/mercadopago.svg', title: 'Mercado Pago', text: 'Tarjetas, Mercado Crédito y saldo, protegidos por la pasarela.', tag: 'Pago protegido' },
]

const TRUST = [
  { icon: 'inventory_2', title: 'Stock real', text: 'Disponibilidad consultada en tiempo real con Elit.' },
  { icon: 'verified_user', title: 'Garantía escrita', text: '2 años de garantía con número de serie verificado.' },
  { icon: 'receipt_long', title: 'Factura A o B', text: 'Comprobante válido generado con tus datos fiscales.' },
  { icon: 'local_shipping', title: 'Envío protegido', text: 'Embalaje precintado y seguimiento de tu pedido.' },
]

const ICONS = {
  notebooks: '💻', hardware: '⚙️', almacenamiento: '💾', perifericos: '🖱️', audio: '🎧',
  cables: '🔌', seguridad: '📷', conectividad: '📡', 'unidad-de-energia': '🔋',
  celulares: '📱', gpus: '🎮', procesadores: '🧠', memorias: '🧠', accesorios: '🧩',
}

const CAT_LABELS = {
  notebooks: 'Notebooks', hardware: 'Hardware', almacenamiento: 'Almacenamiento',
  perifericos: 'Periféricos', audio: 'Audio', cables: 'Cables', seguridad: 'Seguridad',
  conectividad: 'Conectividad', 'unidad-de-energia': 'Fuentes',
}

export default function Home({ products = [], categorias = [], onExplore, onSelectCategory, onOpenProduct, onAddToCart }) {
  const cats = categorias.filter(c => c.id !== 'todos').slice(0, 6)
  const destacados = products.filter(p => Number(p.stock) > 0).slice(0, 4)
  const waHref = waLink('Hola! Quiero hablar con un especialista de TechnoStore')

  return (
    <>
      {/* 1. HERO */}
      <section className="ds-hero">
        <div className="ds-hero__grid">
          <div>
            <div className="ds-hero__badges">
              <span className="ds-badge ds-badge--shield">● Semana Tech</span>
              <span className="ds-badge ds-badge--primary">◆ Tecnología oficial</span>
              <span className="ds-badge ds-badge--light">↗ Envío a todo el país</span>
            </div>
            <h1>Renová tu setup con tecnología <em>oficial</em> y confianza.</h1>
            <p className="ds-hero__sub">
              GPUs, workstations y memorias con <b>stock real</b>, garantía escrita y facturación A/B.
              Elegí tu medio de pago — <b>Openpay BBVA, SiPago Credicoop, Mercado Pago</b> o transferencia —
              y consultá las promos vigentes de cada pasarela antes de comprar.
            </p>
            <div className="ds-hero__actions">
              <button className="ds-btn ds-btn--primary" onClick={onExplore}>Ver catálogo →</button>
              <a className="ds-btn ds-btn--outline" href={waHref} target="_blank" rel="noreferrer">Chatear con especialista</a>
            </div>
            <div className="ds-trust-chips">
              <div className="ds-trust-chip"><span className="ds-trust-chip__icon">⬡</span><div><b>Stock 100% real</b><span>Verificado con Elit</span></div></div>
              <div className="ds-trust-chip"><span className="ds-trust-chip__icon">▣</span><div><b>Embalaje precintado</b><span>Protección anti-golpes</span></div></div>
              <div className="ds-trust-chip"><span className="ds-trust-chip__icon">▤</span><div><b>Factura A o B</b><span>Datos fiscales válidos</span></div></div>
            </div>
          </div>
          <div className="ds-hero__media">
            <video autoPlay muted loop playsInline preload="metadata" poster={`${import.meta.env.BASE_URL}assets/video/technostore-poster.jpg`}>
              <source src={`${import.meta.env.BASE_URL}assets/video/technostore-hero.mp4`} type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* 2. MEDIOS DE PAGO */}
      <section className="ds-section ds-section--tint">
        <div>
          <div className="ds-section__head">
            <div><span className="ds-section__eyebrow">Pagá como te convenga</span><h2>Medios de pago y pasarelas</h2>
              <p className="ds-section__sub">Promociones y cuotas informativas — se aplican según la pasarela al confirmar.</p></div>
            <button className="ds-btn ds-btn--outline" onClick={() => document.getElementById('checkout-info')?.scrollIntoView({ behavior: 'smooth' })}>Ver opciones</button>
          </div>
          <div className="ds-pay-grid">
            {PAY_CARDS.map(p => (
              <div key={p.id} className="ds-pay-card" id={p.id === 'transferencia' ? 'checkout-info' : undefined}>
                {p.logo ? <img src={p.logo} alt="" loading="lazy" /> : <div className="ds-trust-chip__icon">↗</div>}
                <b>{p.title}</b><p>{p.text}</p><span className="ds-pay-card__tag">{p.tag}</span>
              </div>
            ))}
          </div>
          <p className="ds-section-note">Los beneficios bancarios son informativos y están sujetos a las condiciones vigentes de cada pasarela.</p>
        </div>
      </section>

      {/* 3. CATEGORÍAS */}
      <section className="ds-section">
        <div className="ds-section__head">
          <div><span className="ds-section__eyebrow">Explorá</span><h2>Categorías populares</h2></div>
          <button className="ds-btn ds-btn--outline" onClick={onExplore}>Ver todo el catálogo</button>
        </div>
        <div className="ds-cat-grid">
          {cats.map(c => (
            <button key={c.id} className="ds-cat-card" onClick={() => onSelectCategory?.(c.id)}>
              <span className="ds-cat-card__icon" aria-hidden>{ICONS[c.id] || '◈'}</span>
              <b>{CAT_LABELS[c.id] || c.label}</b>
            </button>
          ))}
        </div>
      </section>

      {/* 4. MÁS VENDIDOS */}
      {destacados.length > 0 && (
        <section className="ds-section ds-section--tint">
          <div>
            <div className="ds-section__head">
              <div><span className="ds-section__eyebrow">Despacho rápido</span><h2>Lo que más se llevan</h2>
                <p className="ds-section__sub">Productos con stock disponible y precio final con impuestos.</p></div>
            </div>
            <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {destacados.map(p => <ProductCard key={p.sku} producto={p} onDetail={onOpenProduct} onAddToCart={onAddToCart} />)}
            </div>
          </div>
        </section>
      )}

      {/* 5. CYBERTRUST */}
      <section className="ds-section">
        <div className="ds-section__head"><div><span className="ds-section__eyebrow">CyberTrust TechnoStore</span><h2>Por qué comprar con nosotros</h2></div></div>
        <div className="ds-trust-grid">
          {TRUST.map(t => (
            <div key={t.title} className="ds-trust-card">
              <span className="ds-trust-card__icon" aria-hidden>{t.icon === 'inventory_2' ? '⬡' : t.icon === 'verified_user' ? '✓' : t.icon === 'receipt_long' ? '▤' : '↗'}</span>
              <b>{t.title}</b><p>{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. PRUEBA SOCIAL (sin testimonios inventados) + 7. CONCIERGE */}
      <section className="ds-section">
        <div className="ds-concierge">
          <div>
            <h2>¿Necesitás ayuda para elegir? Hablá con un especialista</h2>
            <p>Te ayudamos a comparar specs, compatibilidad y opciones de entrega por WhatsApp.</p>
          </div>
          <a className="ds-btn" href={waHref} target="_blank" rel="noreferrer">Escribinos por WhatsApp</a>
        </div>
      </section>
    </>
  )
}
