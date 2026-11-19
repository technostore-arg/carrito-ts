/** Ficha de producto (TechnoStore): galería, tabla de specs, compatibilidad, envío estimado por CP, garantía, CTA fijo en móvil. */
import { useEffect, useState } from 'react'
import { ars, waLink } from '../utils/format.js'
import { shippingCost } from '../config/store.js'
import { stockState, STOCK_LABELS } from '../utils/stock.js'
import ProductMedia from './ProductMedia.jsx'
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'

export default function ProductDetail({ producto, onClose, onAddToCart }) {
  const [cp, setCp] = useState('')
  useEffect(() => {
    document.body.classList.add('locked')
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => { document.body.classList.remove('locked'); window.removeEventListener('keydown', h) }
  }, [onClose])

  if (!producto) return null
  const { nombre, descripcion, categoria, imagenes, sku, marca, especificaciones } = producto
  const state = stockState(producto)
  const sinCompra = state === 'agotado' || state === 'encargo'
  const waHref = waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`)

  const gallery = (imagenes || []).filter(Boolean)
  const specs = Object.entries(especificaciones || {}).filter(([k]) => !k.startsWith('_'))
  const price = Number(producto.precio_transferencia ?? producto.precio ?? 0)
  const waSub = waLink(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`)

  return (
    <div className="ts-modal-backdrop" onClick={onClose}>
      <div className="ts-modal ts-modal--product" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" className="ts-modal-close" onClick={onClose} aria-label="Cerrar">✕</Button>

        <div className="ts-detail">
          <div className="ts-detail-gallery">
            {gallery.length ? gallery.map((im, i) => (
              <ProductMedia key={i} src={im} alt={i === 0 ? nombre : ''} className={i === 0 ? 'ts-detail-gallery__main' : 'ts-detail-gallery__thumb'} eager={i === 0} />
            )) : <ProductMedia src={producto.imagenes?.[0]} alt={nombre} className="ts-detail-gallery__main" eager />}
          </div>

          <div className="ts-detail-side">
            <div className="ts-detail-meta">
              <span className="ts-product-card__sku">{sku}</span>
              <Badge variant="discount">{categoria}</Badge>
              {marca && <Badge variant="neutral">{marca}</Badge>}
              <Badge variant={state === 'encargo' ? 'encargo' : 'high'}>
                {state === 'encargo' ? 'A pedido' : state === 'agotado' ? 'Sin stock' : `Stock ${producto.stock ?? 0}`}
              </Badge>
              {producto.condicion === 'usado' && <Badge variant="used">Usado</Badge>}
            </div>

            <h1 className="ts-detail-title">{nombre}</h1>
            {descripcion && <p className="ts-detail-desc">{descripcion}</p>}

            <div className="ts-detail-price">
              <div className="ts-product-card__price">
                <span className="ts-price">{ars(price)}</span>
                {producto.precio_mercadopago && Number(producto.precio_mercadopago) > price && <span className="ts-price__alt">{ars(producto.precio_mercadopago)}</span>}
              </div>
              <p className="ts-price__hint">IVA incluido en el precio de transferencia · Precio dual (transferencia / lista)</p>
            </div>

            {specs.length > 0 && (
              <table className="ts-detail-table">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td>{String(v)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Compartición de memoria</th>
                    <td>{String(specs.length)} especificaciones clave</td>
                  </tr>
                </tbody>
              </table>
            )}

            <div className="ts-detail-compat">
              <h4>Compatibilidad</h4>
              <div className="ts-detail-compat__row">
                <span className="ts-detail-compat__label">Manejo de memoria</span>
                <span className="ts-detail-compat__val">{String(especificaciones?._ddr || 'DDR5')}</span>
              </div>
              <div className="ts-detail-compat__row">
                <span className="ts-detail-compat__label">Tipo de memoria</span>
                <span className="ts-detail-compat__val">{String(especificaciones?._tipo_memoria || 'ECC')}</span>
              </div>
            </div>

            <div className="ts-detail-shipping">
              <h4>Envío estimado por CP</h4>
              <FormField label="Tu código postal" id="ts-cp-input" hint="El envío estimado se calcula en tiempo real" className="ts-detail-cp">
                <input id="ts-cp-input" className="ts-field-input" value={cp} onChange={e => setCp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="1424" />
              </FormField>
              <p className="ts-detail-shipping__estimate">
                {cp
                  ? `Estimado para el CP ${cp}: ${ars(shippingCost(cp, price)) || '$0'}`
                  : 'Ingresá tu CP para calcular el envío estimado. Envío gratis a partir de $300.000.'}
              </p>
            </div>

            <div className="ts-detail-warranty">
              <h4>Garantía</h4>
              <p>{STOCK_LABELS.garantia || `${producto.garantia || '2 años'} de garantía oficial · Garantía escrita con número de serie`}</p>
            </div>

            <Button
              variant={sinCompra ? 'secondary' : 'primary'}
              className="ts-product-cta"
              onClick={() => { if (!sinCompra) onAddToCart?.(producto) }}
            >
              {sinCompra ? `Consultar por WhatsApp` : `Agregar al carrito · ${ars(price)}`}
            </Button>
            <a className="ts-product-cta-wa" href={waHref} target="_blank" rel="noreferrer">O consultá por WhatsApp</a>
            {sinCompra && <p className="ts-product-encargo">{sinCompra ? 'Stock agotado o a pedido — consultanos por WhatsApp' : ''}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
