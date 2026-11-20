/** Vista genérica con el HTML exacto de una propuesta Stitch (desktop/mobile). */
import { useEffect, useRef, useState } from 'react'

import { resolveStitchAction } from '../utils/stitchActions.js'
import { hydrateStitch } from '../utils/hydrateStitch.js'

export default function StitchView({ name, inline = false, products = [], categorias = [], cartItems = [], cartCount = 0, product = null, onClose, onAction, onProduct, onAdd }) {
  const ref = useRef(null)
  const [html, setHtml] = useState('')

  useEffect(() => {
    if (!name) { setHtml(''); return }
    const mq = window.matchMedia('(max-width: 700px)')
    let alive = true
    const load = () => {
      const forceMobile = new URLSearchParams(window.location.search).get('device') === 'mobile'
    const device = (mq.matches || forceMobile) ? 'mobile' : 'desktop'
      fetch(`${import.meta.env.BASE_URL}stitch/${name}-${device}.html`)
        .then(r => (r.ok ? r.text() : ''))
        .then(text => {
          if (!alive) return
          const doc = new DOMParser().parseFromString(text, 'text/html')
          hydrateStitch(doc, { products, categorias, cartItems, cartCount, product, screen: name })
          setHtml(doc.body.innerHTML)
        })
        .catch(() => alive && setHtml(''))
    }
    load()
    mq.addEventListener('change', load)
    return () => { alive = false; mq.removeEventListener('change', load) }
  }, [name, products, categorias, cartItems, cartCount, product])

  useEffect(() => {
    if (!html || !ref.current) return
    const root = ref.current
    const onClick = e => {
      const el = e.target.closest('[data-path], a, button')
      if (!el) return
      const path = el.getAttribute('data-path') || ''
      const text = (el.innerText || '').toLowerCase()
      if (/cerrar|close|volver|atrás|atras/.test(text)) { e.preventDefault(); onClose?.(); return }
      const heroNav = el.closest('[data-hero-next], [data-hero-prev], [data-hero-dot]')
      if (heroNav) {
        e.preventDefault()
        const slider = heroNav.closest('[data-hero-slider]')
        const slides = [...(slider?.querySelectorAll('[data-hero-slide]') || [])]
        if (slides.length) {
          const active = slides.findIndex(s => s.classList.contains('is-active'))
          const step = heroNav.hasAttribute('data-hero-next') ? 1 : heroNav.hasAttribute('data-hero-prev') ? -1 : 0
          const dot = heroNav.getAttribute('data-hero-dot')
          const idx = dot !== null ? Number(dot) : (active + step + slides.length) % slides.length
          slides.forEach((s, i) => s.classList.toggle('is-active', i === idx))
          slider.querySelectorAll('[data-hero-dot]').forEach((d, i) => d.classList.toggle('is-active', i === idx))
        }
        return
      }
      const carousel = el.closest('[data-carousel]')
      if (carousel) {
        e.preventDefault()
        const track = carousel.closest('[data-stitch-carousel]')?.querySelector('[data-carousel-track]')
        track?.scrollBy({ left: carousel.getAttribute('data-carousel') === 'next' ? 340 : -340, behavior: 'smooth' })
        return
      }
      const add = el.closest('[data-add]')
      if (add) { e.preventDefault(); onAdd?.(add.getAttribute('data-add')); return }
      const sku = el.closest('[data-sku]')
      if (sku) { e.preventDefault(); onProduct?.(sku.getAttribute('data-sku')); return }
      onAction?.(resolveStitchAction(path), path, el)
      if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault()
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [html, onClose, onAction, onProduct, onAdd])

  // Catálogo unificado: filtros, orden y paginación (12 por página).
  useEffect(() => {
    if (!html || !ref.current) return
    const root = ref.current
    const catalog = root.querySelector('[data-catalog]')
    if (!catalog) return
    const PAGE = 12
    const grid = catalog.querySelector('[data-catalog-grid]')
    const items = [...grid.querySelectorAll('[data-catalog-item]')]
    const count = catalog.querySelector('[data-catalog-count]')
    const info = catalog.querySelector('[data-page-info]')
    const pager = catalog.querySelector('[data-page-buttons]')
    const val = sel => catalog.querySelector(`[data-filter="${sel}"]`)?.value || 'todos'
    let page = 1
    let pages = 1
    const apply = () => {
      const cat = val('cat'), marca = val('marca'), precio = val('precio'), oferta = val('oferta')
      const orden = catalog.querySelector('[data-order]')?.value || 'destacados'
      const PRIORITY = ['hardware', 'memorias', 'computadoras', 'almacenamiento', 'perifericos', 'audio', 'imagen', 'conectividad', 'seguridad', 'cables', 'insumos']
      const prio = d => { const i = PRIORITY.indexOf(d.cat.split(' ')[0]); return i === -1 ? 50 : i }
      const cmp = (a, b) => {
        const da = a.dataset, db = b.dataset
        if (orden === 'precio-asc') return Number(da.precio) - Number(db.precio)
        if (orden === 'precio-desc') return Number(db.precio) - Number(da.precio)
        if (orden === 'nombre') return (da.nombre || '').localeCompare(db.nombre || '')
        if (orden === 'oferta') return (Number(db.oferta) - Number(da.oferta)) || (Number(db.precio) - Number(da.precio))
        return (prio(da) - prio(db)) || (Number(db.stock) - Number(da.stock)) || ((da.nombre || '').localeCompare(db.nombre || ''))
      }
      const visible = items.filter(el => {
        const d = el.dataset
        const p = Number(d.precio) || 0
        return (cat === 'todos' || d.cat.split(' ').includes(cat))
          && (marca === 'todos' || d.marca === marca)
          && (oferta !== 'si' || d.oferta === '1')
          && (precio === 'todos'
            || (precio === '0-100000' && p <= 100000)
            || (precio === '100000-500000' && p >= 100000 && p <= 500000)
            || (precio === '500000-1000000' && p >= 500000 && p <= 1000000)
            || (precio === '1000000+' && p > 1000000))
      }).sort(cmp)
      pages = Math.max(1, Math.ceil(visible.length / PAGE))
      page = Math.min(Math.max(1, page), pages)
      const shown = visible.slice((page - 1) * PAGE, page * PAGE)
      for (const el of items) el.style.display = 'none'
      for (const el of shown) { el.style.display = ''; grid.appendChild(el) }
      if (count) count.textContent = String(visible.length)
      if (info) info.textContent = visible.length ? `Página ${page} de ${pages} · ${shown.length} productos` : 'Sin resultados'
      if (pager) {
        const nums = []
        for (let i = 1; i <= pages; i++) {
          if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
          else if (nums[nums.length - 1] !== '…') nums.push('…')
        }
        pager.innerHTML = `<button type="button" data-page="prev" ${page === 1 ? 'disabled' : ''} class="w-9 h-9 rounded-lg border border-border-subtle text-on-surface font-bold">‹</button>`
          + nums.map(n => n === '…' ? '<span class="px-1 text-on-surface-variant">…</span>'
            : `<button type="button" data-page="${n}" class="w-9 h-9 rounded-lg font-label-md font-bold ${n === page ? 'bg-primary-container text-on-primary' : 'border border-border-subtle text-on-surface'}">${n}</button>`).join('')
          + `<button type="button" data-page="next" ${page === pages ? 'disabled' : ''} class="w-9 h-9 rounded-lg border border-border-subtle text-on-surface font-bold">›</button>`
      }
    }
    const onChange = e => {
      if (!e.target.matches('[data-filter], [data-order]')) return
      page = 1
      apply()
    }
    const onClick = e => {
      const p = e.target.closest('[data-page]')
      if (p) {
        const v = p.getAttribute('data-page')
        page = v === 'prev' ? Math.max(1, page - 1) : v === 'next' ? Math.min(pages, page + 1) : Number(v)
        apply()
        return
      }
      if (!e.target.closest('[data-catalog-reset]')) return
      for (const s of catalog.querySelectorAll('[data-filter]')) s.value = 'todos'
      const order = catalog.querySelector('[data-order]')
      if (order) order.value = 'destacados'
      page = 1
      apply()
    }
    root.addEventListener('change', onChange)
    root.addEventListener('click', onClick)
    apply()
    return () => { root.removeEventListener('change', onChange); root.removeEventListener('click', onClick) }
  }, [html])

  // Transparencia: última actualización del catálogo.
  useEffect(() => {
    if (!html || !ref.current) return
    const el = ref.current.querySelector('[data-catalog-updated]')
    if (!el) return
    fetch('/api/catalog/stats')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const last = d?.syncs?.find(s => /stock/i.test(s.job || '')) || d?.syncs?.[0]
        if (!last?.finishedAt) { el.textContent = ''; return }
        const f = new Date(last.finishedAt)
        el.textContent = `Actualizado ${f.toLocaleDateString('es-AR')} ${f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
      })
      .catch(() => { el.textContent = '' })
  }, [html])

  // Auto-avance del carrusel de imágenes del banner.
  useEffect(() => {
    if (!html || !ref.current) return
    const slider = ref.current.querySelector('[data-hero-slider]')
    if (!slider) return
    const id = setInterval(() => {
      const slides = [...slider.querySelectorAll('[data-hero-slide]')]
      if (!slides.length) return
      const active = slides.findIndex(s => s.classList.contains('is-active'))
      const idx = (active + 1) % slides.length
      slides.forEach((s, i) => s.classList.toggle('is-active', i === idx))
      slider.querySelectorAll('[data-hero-dot]').forEach((d, i) => d.classList.toggle('is-active', i === idx))
    }, 5000)
    return () => clearInterval(id)
  }, [html])

  // Búsqueda en vivo con sugerencias (delegada, porque el HTML se inyecta como string).
  useEffect(() => {
    if (!html || !ref.current) return
    const root = ref.current
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const find = q => {
      const s = q.trim().toLowerCase()
      if (s.length < 2) return []
      return products.filter(p => `${p.nombre || ''} ${p.sku || ''} ${p.marca || ''} ${p.categoria || ''}`.toLowerCase().includes(s)).slice(0, 6)
    }
    const onInput = e => {
      if (!e.target.matches?.('[data-stitch-search]')) return
      const wrap = e.target.closest('[data-stitch-search-wrap]')
      const box = wrap?.querySelector('[data-stitch-suggest]')
      if (!box) return
      const q = e.target.value
      const items = find(q)
      if (q.trim().length < 2) { box.innerHTML = ''; box.classList.add('hidden'); return }
      box.innerHTML = (items.length
        ? items.map(p => `<button type="button" class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-low text-left" data-path="detalle-de-producto" data-sku="${esc(p.sku)}"><img class="w-10 h-10 object-contain rounded-lg bg-surface-container-low" src="${esc(p.imagenes?.[0] || '')}" alt=""><span class="flex-1 min-w-0"><b class="block text-label-lg text-on-surface truncate">${esc(p.nombre || '')}</b><small class="text-label-sm text-on-surface-variant">${esc(p.sku)} · ${esc(p.categoria || '')}</small></span><span class="font-bold text-primary text-body-sm">$${Number((p.precio_transferencia ?? p.precio) || 0).toLocaleString('es-AR')}</span></button>`).join('')
          + '<button type="button" class="w-full px-4 py-3 text-primary font-label-md font-bold text-left border-t border-border-subtle" data-path="catalogo-de-productos">Ver todos los resultados →</button>'
        : '<p class="px-4 py-3 text-body-sm text-on-surface-variant">Sin resultados para esa búsqueda.</p>')
      box.classList.remove('hidden')
    }
    const onKey = e => {
      if (e.key !== 'Enter' || !e.target.matches?.('[data-stitch-search]')) return
      const wrap = e.target.closest('[data-stitch-search-wrap]')
      const first = wrap?.querySelector('[data-stitch-suggest] [data-sku]') || wrap?.querySelector('[data-stitch-suggest] [data-path="catalogo-de-productos"]')
      first?.click()
    }
    root.addEventListener('input', onInput)
    root.addEventListener('keydown', onKey)
    return () => { root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKey) }
  }, [html, products])

  if (!name) return null
  const body = <div ref={ref} className="stitch-view" dangerouslySetInnerHTML={{ __html: html }} />
  if (inline) return body
  return (
    <div className="stitch-overlay" role="dialog" aria-modal="true" aria-label={name}>
      <button className="stitch-overlay__close" onClick={onClose} aria-label="Cerrar"><span className="material-symbols-outlined">close</span>Cerrar</button>
      {body}
    </div>
  )
}
