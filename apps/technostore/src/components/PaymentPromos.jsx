/** Selector de medios de pago + promociones vigentes por pasarela/banco. */
import { PAYMENT_METHODS, promosVigentes } from '../config/payments.js'
import './payments.css'

export function PaymentMethods({ value, onChange }) {
  return (
    <div className="pay-options">
      {PAYMENT_METHODS.map(m => (
        <button
          type="button"
          key={m.id}
          className={`pay-option ${value === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
          aria-pressed={value === m.id}
        >
          <span className="pay-radio" aria-hidden />
          {m.logo && <img className="pay-logo" src={m.logo} alt="" loading="lazy" />}
          <span><b>{m.label}</b><small>{m.note}</small></span>
        </button>
      ))}
    </div>
  )
}

export function PaymentPromos() {
  const vigentes = promosVigentes()
  if (!vigentes.length) return null
  return (
    <div className="pay-promos">
      <h4>Promociones vigentes con estos medios de pago</h4>
      <ul>
        {vigentes.map(p => (
          <li key={p.id}>
            <img
              className="pay-promo__logo"
              src={p.bank === 'bbva' ? '/payments/bbva.svg' : p.bank === 'credicoop' ? '/payments/credicoop.svg' : `/payments/${p.gateway}.svg`}
              alt=""
              loading="lazy"
            />
            <div>
              <b>{p.title}</b>
              <small>{p.gatewayName}{p.bankName ? ` · ${p.bankName}` : ''} · {p.cards}</small>
              <p>{p.detail}</p>
              <a href={p.link} target="_blank" rel="noreferrer">Ver condiciones y legales →</a>
            </div>
          </li>
        ))}
      </ul>
      <p className="pay-promos__note">
        Promociones informativas sujetas a la adhesión del comercio y a las condiciones de cada pasarela. El beneficio se aplica en el checkout de la pasarela, no en el precio del carrito.
      </p>
    </div>
  )
}
