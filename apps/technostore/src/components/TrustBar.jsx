/** Barra de confianza en Home — reemplaza "local en Palermo" con garantía escrita, facturación A/B y atención por WhatsApp. */
import { waLink } from '../utils/format.js'
import { Badge } from './Badge.jsx'

export default function TrustBar() {
  const items = [
    { badge: 'garantía escrita', title: '2 años de garantía', text: 'Llicencia oficial y número de serie en cada equipo', href: null },
    { badge: 'facturación A/B', title: 'Facturación A/B válida', text: 'Código fiscal generado para tu provincia', href: null },
    { badge: 'atención WhatsApp', title: 'Atención por WhatsApp', text: 'Consultá a nuestro equipo sin generar pedido', href: waLink('Hola, consulto un producto') },
  ]
  return (
    <div className="ts-trust">
      {items.map((it, i) => (
        <div key={i} className="ts-trust__item">
          <Badge variant="discount">{it.badge}</Badge>
          <strong className="ts-trust__title">{it.title}</strong>
          <span className="ts-trust__text">{it.text}</span>
          {it.href && <a className="ts-trust__link" href={it.href} target="_blank" rel="noreferrer">Consultar</a>}
        </div>
      ))}
    </div>
  )
}
