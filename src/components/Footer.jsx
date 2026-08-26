import { waLink } from '../utils/format'

export default function Footer({ onSelectCategory }) {
  const cats = [
    ['gpus', 'Placas Gráficas IA'],
    ['memorias', 'Memorias & Storage'],
    ['workstations', 'Workstations IA'],
    ['accesorios', 'Accesorios'],
  ]

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="logo footer-logo">
            <span className="logo-mark">🧠</span>
            Techno<span className="grad-text">Store</span>
          </div>
          <p className="muted">
            Hardware especializado para inteligencia artificial: GPUs de alta VRAM,
            memorias DDR5/ECC y workstations armadas y testeadas para correr modelos
            locales desde el primer minuto.
          </p>
          <div className="pay-chips">
            <span>MercadoPago</span>
            <span>VISA</span>
            <span>Mastercard</span>
            <span>AMEX</span>
            <span>Transferencia</span>
          </div>
        </div>

        <div>
          <h4>Catálogo</h4>
          <ul>
            {cats.map(([id, label]) => (
              <li key={id}>
                <button onClick={() => onSelectCategory(id)}>{label}</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>Servicios</h4>
          <ul>
            <li><a href="#servicios">Instalación de modelos locales</a></li>
            <li><a href="#servicios">Setup Ollama · vLLM · ComfyUI</a></li>
            <li><a href="#comparativa">Comparativa de GPUs para IA</a></li>
            <li><a
              href={waLink('Hola! Tengo una consulta sobre hardware de IA')}
              target="_blank"
              rel="noreferrer"
            >Asesoramiento por WhatsApp</a></li>
          </ul>
        </div>

        <div>
          <h4>Contacto</h4>
          <ul>
            <li>📱 +54 9 11 2765-0658</li>
            <li>✉️ tsbarrionorte@gmail.com</li>
            <li>📍 Av. Santa Fe 2844, Palermo · CABA</li>
            <li>🕐 Lun-Vie 12 a 20h · Sáb 12 a 18h</li>
            <li><a href="https://www.instagram.com/technostore_ts" target="_blank" rel="noreferrer">@technostore_ts ↗</a></li>
          </ul>
        </div>
      </div>
      <div className="container copyright">
        © 2026 TechnoStore · Todos los derechos reservados · Términos y condiciones · Política de privacidad
      </div>
    </footer>
  )
}
