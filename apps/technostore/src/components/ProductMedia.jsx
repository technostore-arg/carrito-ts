import { useEffect, useState } from 'react'
import { modernSrc } from '../utils/images.js'

/**
 * Imagen con lazy loading, fuentes modernas cuando están disponibles
 * y skeleton con dimensiones fijas para evitar CLS.
 */
export default function ProductMedia({ src, alt, className = '', eager = false }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(false) }, [src])

  const avif = modernSrc(src, 'avif')
  const webp = modernSrc(src, 'webp')

  return (
    <div className={`product-media ${className} ${loaded ? 'is-loaded' : ''}`}>
      {!loaded && <div className="media-skeleton shimmer" aria-hidden />}
      {src ? (
        <picture>
          {avif && <source type="image/avif" srcSet={avif} />}
          {webp && <source type="image/webp" srcSet={webp} />}
          <img
            src={src}
            alt={alt}
            width="800"
            height="800"
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </picture>
      ) : (
        <div className="media-fallback" aria-hidden>○</div>
      )}
    </div>
  )
}
