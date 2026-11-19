export default function Footer({ onSelectCategory }) {
  const cats = [
    ['celulares', 'Celulares'],
    ['gpus', 'Placas de Video'],
    ['procesadores', 'Procesadores'],
    ['ram', 'RAM / SSD'],
    ['coolers', 'Coolers'],
    ['accesorios', 'Ver todo'],
  ]
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-logo"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="TechnoStore" style={{ height: 24 }} /> TechnoStore</div>
          <p>Electrónica y hardware con garantía oficial. Av. Santa Fe 2844, Palermo.</p>
          <div className="pay-chips"><span>Transferencia</span><span>Efectivo</span></div>
        </div>
        <div>
          <h4>Categorías</h4>
          <ul>{cats.map(([id, label]) => <li key={id}><button onClick={() => onSelectCategory(id)}>{label}</button></li>)}</ul>
        </div>
        <div>
          <h4>Ayuda</h4>
          <ul><li><a href="#catalogo">Envíos</a></li><li><a href="#catalogo">Garantía</a></li><li><a href="#catalogo">Cambios</a></li></ul>
        </div>
        <div>
          <h4>Contacto</h4>
          <ul><li>+54 9 11 2765-0658</li><li>tsbarrionorte@gmail.com</li><li>Av. Santa Fe 2844 · CABA</li><li>Lun–Vie 12–20 · Sáb 12–18</li></ul>
        </div>
      </div>
      <div className="container copyright">© 2026 TechnoStore · <a href="https://www.instagram.com/technostore_ts" target="_blank" rel="noreferrer">Instagram</a></div>
    </footer>
  )
}
