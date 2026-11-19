/** Vista genérica con el HTML exacto de una propuesta Stitch (desktop/mobile). */
import { useEffect, useRef, useState } from 'react'

import { resolveStitchAction } from '../utils/stitchActions.js'
import { hydrateStitch } from '../utils/hydrateStitch.js'

export default function StitchView({ name, inline = false, products = [], categorias = [], onClose, onAction, onProduct, onAdd }) {
  const ref = useRef(null)
  const [html, setHtml] = useState('')

  useEffect(() => {
    if (!name) { setHtml(''); return }
    const mq = window.matchMedia('(max-width: 700px)')
    let alive = true
    const load = () => {
      const device = mq.matches ? 'mobile' : 'desktop'
      fetch(`${import.meta.env.BASE_URL}stitch/${name}-${device}.html`)
        .then(r => (r.ok ? r.text() : ''))
        .then(text => {
          if (!alive) return
          const doc = new DOMParser().parseFromString(text, 'text/html')
          hydrateStitch(doc, { products, categorias })
          setHtml(doc.body.innerHTML)
        })
        .catch(() => alive && setHtml(''))
    }
    load()
    mq.addEventListener('change', load)
    return () => { alive = false; mq.removeEventListener('change', load) }
  }, [name, products, categorias])

  useEffect(() => {
    if (!html || !ref.current) return
    const root = ref.current
    const onClick = e => {
      const el = e.target.closest('[data-path], a, button')
      if (!el) return
      const path = el.getAttribute('data-path') || ''
      const text = (el.innerText || '').toLowerCase()
      if (/cerrar|close|volver|atrás|atras/.test(text)) { e.preventDefault(); onClose?.(); return }
      const add = el.closest('[data-add]')
      if (add) { e.preventDefault(); onAdd?.(add.getAttribute('data-add')); return }
      const sku = el.closest('[data-sku]')
      if (sku) { e.preventDefault(); onProduct?.(sku.getAttribute('data-sku')); return }
      onAction?.(resolveStitchAction(path), path, el)
      if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault()
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [html, onClose, onAction])

  if (!name) return null
  const body = <div ref={ref} className="stitch-view" dangerouslySetInnerHTML={{ __html: html }} />
  if (inline) return body
  return (
    <div className="stitch-overlay" role="dialog" aria-modal="true" aria-label={name}>
      <button className="stitch-overlay__close" onClick={onClose} aria-label="Cerrar">✕</button>
      {body}
    </div>
  )
}
