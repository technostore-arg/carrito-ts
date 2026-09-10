export default function Footer({ onSelectCategory }) {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-logo"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Futuro Hard" style={{ height: 24 }} /> Futuro Hard</div>
          <p>Vertical IA de TechnoStore — Hardware para modelos locales.<br />Parte del ecosistema <a href="http://localhost:5173" style={{ textDecoration: 'underline' }}>TechnoStore</a>.</p>
          <div className="pay-chips"><span>Transferencia</span><span>Efectivo</span></div>
        </div>
        <div><h4>Hardware</h4><ul><li><button onClick={() => onSelectCategory('gpus')}>Placas gráficas</button></li><li><button onClick={() => onSelectCategory('memorias')}>Memorias & Storage</button></li><li><button onClick={() => onSelectCategory('notebooks')}>Notebooks</button></li></ul></div>
        <div><h4>Servicio</h4><ul><li><a href="#servicios">Instalación modelos locales</a></li><li><a href="#comparativa">Comparativa VRAM</a></li></ul></div>
        <div><h4>Contacto</h4><ul><li>+54 9 11 2765-0658</li><li>tsbarrionorte@gmail.com</li><li>Av. Santa Fe 2844 · Palermo</li></ul></div>
      </div>
      <div className="container copyright">© 2026 Futuro Hard · ecosistema TechnoStore</div>
    </footer>
  )
}
