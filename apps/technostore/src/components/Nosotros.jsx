/** Página Nosotros: pruebas de equipos con número de serie, proceso de testeo y garantía. */
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'
import { waLink } from '../utils/format.js'

const STEPS = [
  { n: 1, title: 'Armado de equipo', text: 'Integración de hardware: placa base, CPU/APU, memoria ECC y almacenamiento NVMe. Cada pieza se verifica contra su especificación técnica.' },
  { n: 2, title: 'Benchmarks por especificación', text: 'Pasos de prueba definidos: transcodificación de video 4K, inferencia con modelos locales, sincronización de ECC y fuentes de energía. Las métricas se registran por equipo.' },
  { n: 3, title: 'Licencia y número de serie', text: 'Llicencia oficial de fabrica en cada equipo, verificada en nuestro sistema con su número de serie único.' },
  { n: 4, title: 'Entrega', text: 'Todo está probado antes de salir al estante. El número de serie y la licencia quedan registrados para el proveedor de integración.' },
]

const ITEMS = [
  { tag: 'Procedimento de prueba', badge: 'garantía escrita' },
  { tag: 'Licencia y número de serie', badge: 'serials registrados' },
]

export default function Nosotros({ onBack }) {
  return (
    <section className="ts-nosotros">
      <header className="ts-nosotros__head">
        <Button variant="ghost" onClick={onBack} className="ts-nosotros__back">← Volver</Button>
        <div>
          <span className="ts-nosotros__eyebrow">Equipos probados · TechnoStore</span>
          <h1 className="ts-nosotros__title">Pruebas, numeros de serie y garantía</h1>
          <p className="ts-nosotros__sub">Nuestro proceso de testeo con número de serie registrado y garantía oficial en cada equipo.</p>
        </div>
      </header>

      <div className="ts-nosotros__grid">
        <div className="ts-nosotros__card">
          <span className="ts-nosotros__tag">Procedimento de prueba</span>
          <ol className="ts-nosotros__steps">
            {STEPS.map(s => (
              <li key={s.n} className="ts-nosotros__step">
                <span className="ts-nosotros__step-num">{s.n}</span>
                <div>
                  <strong className="ts-nosotros__step-title">{s.title}</strong>
                  <span className="ts-nosotros__step-text">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="ts-nosotros__card">
          <span className="ts-nosotros__tag">Videos y benchmarks</span>
          <p className="ts-nosotros__note">Solicitá la grabación del equipo o el reporte en PDF para ver el número de serie y los resultados del benchmark.</p>
          <a className="ts-nosotros__wa" href={waLink('Hola, consulto por los videos y el número de serie de un equipo')} target="_blank" rel="noreferrer">
            Contacto por WhatsApp
          </a>
          <div className="ts-nosotros__gh">
            <Badge variant="new">Garantía escrita 2 años</Badge>
            <Badge variant="new">Licencia oficial de fabrica</Badge>
          </div>
        </div>

        <div className="ts-nosotros__card">
          <span className="ts-nosotros__tag">Garantía</span>
          <p className="ts-nosotros__note">
            Garantía oficial contra defectos de fabrica. RMA con número de serie de equipo y comprobante del problema, expedido tras la entrega.
          </p>
        </div>
      </div>

      <div className="ts-nosotros__cta">
        <span className="ts-nosotros__cta-text">¿Tenés un equipo y querés la garantía registrada?</span>
        <a className="ts-btn ts-btn--primary" href={waLink('Hola, quiero registrar un equipo TechnoStore - guatantia escrita')} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
      </div>
    </section>
  )
}
