/**
 * Home con el HTML exacto del diseño Stitch (desktop/mobile).
 * La paridad visual es la prioridad en esta etapa; la interactividad se conecta
 * por delegación sobre los data-path del propio diseño. Textos/datos se cambian después.
 */
import { useEffect, useRef, useState } from 'react'

const PATH_ACTIONS = {
  'catalogo-de-productos': 'catalog',
  'detalle-de-producto': 'catalog',
  'promociones-bancarias': 'payments',
  'garantias-y-seguridad': 'trust',
  'carrito-de-compras': 'cart',
  'mis-pedidos': 'account',
}

export default function StitchHome({ onExplore, onOpenCart, onAccount }) {
  const ref = useRef(null)
  const [html, setHtml] = useState('')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    let alive = true
    const load = () => {
      const file = mq.matches ? 'home-mobile.html' : 'home-desktop.html'
      fetch(`${import.meta.env.BASE_URL}stitch/${file}`)
        .then(r => r.text())
        .then(text => {
          if (!alive) return
          const doc = new DOMParser().parseFromString(text, 'text/html')
          setHtml(doc.body.innerHTML)
        })
        .catch(() => alive && setHtml(''))
    }
    load()
    mq.addEventListener('change', load)
    return () => { alive = false; mq.removeEventListener('change', load) }
  }, [])

  useEffect(() => {
    if (!html || !ref.current) return
    const root = ref.current
    const onClick = e => {
      const el = e.target.closest('[data-path], a, button')
      if (!el) return
      const action = PATH_ACTIONS[el.getAttribute('data-path') || '']
      if (action === 'catalog') { e.preventDefault(); onExplore?.(); return }
      if (action === 'cart') { e.preventDefault(); onOpenCart?.(); return }
      if (action === 'account') { e.preventDefault(); onAccount?.(); return }
      if (action === 'payments' || action === 'trust') {
        e.preventDefault()
        root.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      const text = (el.innerText || '').trim()
      if (/ver catálogo|ver todos los productos/i.test(text)) { e.preventDefault(); onExplore?.(); return }
      if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault()
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [html, onExplore, onOpenCart, onAccount])

  return <div ref={ref} className="stitch-home" dangerouslySetInnerHTML={{ __html: html }} />
}
