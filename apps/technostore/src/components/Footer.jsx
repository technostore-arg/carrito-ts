/** Footer legal de TechnoStore: razón social, CUIT, Data Fiscal, domicilio fiscal, WhatsApp, políticas y medios de pago. Sin mapa, sin horarios, sin dirección de atención. */
import { waLink } from '../utils/format.js'

const cats = [
  ['celulares', 'Celulares'],
  ['notebooks', 'Notebooks'],
  ['gpus', 'Placas de Video'],
  ['procesadores', 'Procesadores'],
  ['ram', 'RAM / SSD'],
  ['coolers', 'Coolers'],
  ['accesorios', 'Ver todo'],
]

const policies = [
  ['Envíos', waLink('Hola, consulto por los envíos del pedido')],
  ['Garantía', waLink('Hola, consulto por la garantía')],
  ['Cambios', waLink('Hola, consulto por los cambios')],
  ['Devoluciones', waLink('Hola, consulto por devoluciones')],
  ['Condiciones de venta', waLink('Hola, consulto por las condiciones de venta')],
]

const paymentMethods = [
  { label: 'MercadoPago', hint: 'Tarjetas, transferencia y pagos guardados' },
  { label: 'Efectivo', hint: 'Contra entrega' },
  { label: 'Transferencia', hint: 'Banco Comisionado' },
  { label: 'Facturación A/B', hint: 'Código fiscal válido en tu provincia' },
]

export default function Footer({ onSelectCategory }) {
  const base = import.meta.env.BASE_URL || '/'
  return (
    <footer className="ts-footer">
      <div className="ts-footer__grid">
        <div className="ts-footer__col">
          <div className="ts-footer__brand">
            <img src={`${base}logo.svg`} alt="TechnoStore" className="ts-footer__logo" />
            <div>
              <strong className="ts-footer__title">Razón social</strong>
              <p className="ts-footer__text">
                TechnoStore. Solicite a la comercialización la razón social completa y el CUIT — se genera la factura electrónica (Data Fiscal) con el domicilio fiscal registrado.
              </p>
            </div>
          </div>
          <p className="ts-footer__text ts-footer__fiscal"><span className="ts-footer__k">Domicilio fiscal:</span> Av. Santa Fe 2844 — CABA</p>
        </div>

        <div className="ts-footer__col">
          <h4 className="ts-footer__h">Categorías</h4>
          <ul className="ts-footer__ul">
            {cats.map(([id, label]) => (
              <li key={id}><button className="ts-footer__btn" onClick={() => onSelectCategory(id)}>{label}</button></li>
            ))}
          </ul>
        </div>

        <div className="ts-footer__col">
          <h4 className="ts-footer__h">Atención</h4>
          <p className="ts-footer__text">
            Escribinos por WhatsApp o consultá tu producto tras registrarnos.
          </p>
          <a className="ts-footer__wa" href={waLink('Hola, consulto un producto de TechnoStore')} target="_blank" rel="noreferrer">
            Atención por WhatsApp — <span className="ts-footer__wa-num">+54 9 11 2765-0658</span>
          </a>
        </div>

        <div className="ts-footer__col">
          <h4 className="ts-footer__h">Políticas</h4>
          <ul className="ts-footer__ul">
            {policies.map(([label, href]) => <li key={label}><a className="ts-footer__a" href={href} target="_blank" rel="noreferrer">{label}</a></li>)}
          </ul>
        </div>

        <div className="ts-footer__col">
          <h4 className="ts-footer__h">Medios de pago</h4>
          <ul className="ts-footer__ul ts-footer__payments">
            {paymentMethods.map(m => (
              <li key={m.label}><span className="ts-footer__a">{m.label}</span><span className="ts-footer__muted">· {m.hint}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ts-footer__copy">
        TechnoStore · © 2026 · Garantía escrita 2 años
      </div>
    </footer>
  )
}
