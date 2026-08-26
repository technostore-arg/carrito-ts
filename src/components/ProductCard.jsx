import { useRef, useState } from 'react'
import { useCart } from '../context/CartContext'
import { tiltHandlers } from '../hooks/motion'
import { ars } from '../utils/format'

const FW_LABELS = {
  ollama: 'Ollama',
  vllm: 'vLLM',
  comfyui: 'ComfyUI',
  pytorch: 'PyTorch',
  lmstudio: 'LM Studio',
  openwebui: 'OpenWebUI',
}

export default function ProductCard({ product }) {
  const { addToCart } = useCart()
  const ref = useRef(null)
  const tilt = tiltHandlers(ref)
  const [imgError, setImgError] = useState(false)
  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0

  return (
    <article className="card" ref={ref} {...tilt}>
      <div className="card-media">
        {product.image && !imgError ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="fallback">{product.emoji}</span>
        )}
        {(product.badge || discount > 0) && (
          <span className={`badge ${discount > 0 ? 'deal' : ''}`}>
            {discount > 0 ? `-${discount}%` : product.badge}
          </span>
        )}
        {product.vram >= 16 && (
          <span className="vram-chip">{product.vram}GB VRAM</span>
        )}
        {product.stock <= 4 && (
          <span className="stock-warn">¡Últimas {product.stock}!</span>
        )}
      </div>

      <div className="card-body">
        <small className="brand">{product.brand}</small>
        <h3 title={product.name}>{product.name}</h3>

        {product.frameworks?.length > 0 && (
          <div className="fw-chips">
            {product.frameworks.slice(0, 3).map(f => (
              <span key={f}>{FW_LABELS[f] ?? f}</span>
            ))}
          </div>
        )}

        <ul className="specs">
          {product.specs.slice(0, 3).map(s => (
            <li key={s}>{s}</li>
          ))}
        </ul>

        <div className="rating">
          <span className="stars">
            {'★'.repeat(Math.round(product.rating))}
            {'☆'.repeat(5 - Math.round(product.rating))}
          </span>
          <small>{product.rating.toFixed(1)} ({product.reviews})</small>
        </div>

        <div className="price-row">
          <b className="price">{ars(product.price)}</b>
          {product.oldPrice && <s className="old-price">{ars(product.oldPrice)}</s>}
        </div>

        <button className="add-btn" onClick={() => addToCart(product)}>
          Agregar al carrito 🛒
        </button>
      </div>
    </article>
  )
}
